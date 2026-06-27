/**
 * Statistical forecasting via 1-D kriging.
 *
 * Replaces the previous monthly-average heuristics in analytics.js
 * (predictHarvestPeak / predictNextIrrigation) with geostatistical
 * predictions that carry a 95% confidence band:
 *
 *   - Harvest peak  → Ordinary Kriging of NDVI over the day-of-year cycle.
 *                     The next NDVI peak is the argmax of the kriged curve.
 *   - Irrigation    → Universal Kriging (linear drift) of recent NDMI vs time,
 *                     extrapolated until moisture crosses the stress threshold.
 *
 * Output objects keep the same field names the old functions produced, so
 * ForecastPanel and recommendations.js work unchanged — they just gain extra
 * confidence-interval fields and a chart-ready forecast series.
 */
import { cleanData } from './analytics'
import { krigePredictor, cyclicDist } from './kriging'

const DAY_MS = 86_400_000
const STRESS_THRESHOLD = 0.0 // NDMI at/below this = moisture stress
const PERIOD = 365 // day-of-year cycle

const parseDate = (s) => new Date(s + 'T00:00:00Z')

// Day-of-year in [1, 366].
const dayOfYear = (dateStr) => {
  const d = parseDate(dateStr)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 0)
  return Math.round((d.getTime() - yearStart) / DAY_MS)
}

const fmtMonth = (date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
const fmtDate = (date) => date.toISOString().slice(0, 10)

const z95 = 1.96

// ── seasonal NDVI predictor (Ordinary Kriging over day-of-year) ─────────────

function seasonalNdviModel(clean) {
  const samples = clean.map((d) => ({ x: dayOfYear(d.date), z: d.ndvi_mean }))
  return krigePredictor(samples, { distFn: cyclicDist(PERIOD), drift: 'none' })
}

/**
 * Next NDVI peak (harvest window) = argmax of the kriged seasonal curve.
 * Replaces predictHarvestPeak; same output fields plus a confidence interval.
 */
function harvestPeak(clean, model, today) {
  let peakDoy = 1
  let peak = model.predict(1)
  for (let doy = 2; doy <= PERIOD; doy++) {
    const p = model.predict(doy)
    if (p.mean > peak.mean) {
      peak = p
      peakDoy = doy
    }
  }

  // Next calendar date that lands on the peak day-of-year, after today.
  let target = null
  for (let yr = today.getUTCFullYear(); yr <= today.getUTCFullYear() + 2; yr++) {
    const cand = new Date(Date.UTC(yr, 0, peakDoy))
    if (cand.getTime() > today.getTime()) {
      target = cand
      break
    }
  }

  return {
    peakNdvi: peak.mean,
    peakNdviLower: peak.mean - z95 * peak.sd,
    peakNdviUpper: peak.mean + z95 * peak.sd,
    peakDoy,
    nextPeakDate: fmtMonth(target), // 'YYYY-MM' — kept for recommendations.js
    nextPeakDateFull: fmtDate(target),
    daysUntil: Math.round((target.getTime() - today.getTime()) / DAY_MS),
    method: 'ordinary_kriging_seasonal',
  }
}

// ── near-term NDMI forecast (Universal Kriging, linear drift) ───────────────

/**
 * Project recent NDMI forward until it crosses the moisture-stress threshold.
 * Replaces predictNextIrrigation; same output fields plus a confidence band on
 * the projected stress date.
 *
 * When weatherData is provided, the forecast ET is used to accelerate or slow
 * the projected NDMI decline. The mechanism: the kriging model is fit to observed
 * NDMI vs time under historical ET conditions. If the upcoming forecast ET is
 * higher than the seasonal baseline (heatwave), moisture will drain faster than
 * the fitted trend predicts — we compress the effective time axis by the ET ratio
 * so the crossing is found sooner in wall-clock days.
 */
function irrigationForecast(clean, today, weatherData) {
  const recent = clean.slice(-16)
  if (recent.length < 3) return null

  const baseDate = parseDate(recent[0].date)
  const dayOffset = (dateStr) =>
    Math.round((parseDate(dateStr).getTime() - baseDate.getTime()) / DAY_MS)

  const samples = recent.map((d) => ({ x: dayOffset(d.date), z: d.ndmi_mean }))
  const model = krigePredictor(samples, { drift: 'linear' })

  const latest = recent[recent.length - 1]
  const xLast = dayOffset(latest.date)
  const currentNdmi = latest.ndmi_mean
  // Slope per ~5-day observation, from the fitted trend.
  const ndmiSlope = model.predict(xLast).mean - model.predict(xLast - 5).mean

  // ET adjustment: ratio of forecast ET to the seasonal baseline for this month.
  // Clamped so a single extreme value can't collapse the forecast to zero days.
  const rawEtRatio = weatherData?.etAnomalyRatio ?? 1.0
  const etMultiplier = Math.max(0.6, Math.min(2.5, rawEtRatio))
  const forecastET = weatherData?.forecastET ?? null
  const etBaseline = weatherData?.baseline ?? null

  const base = {
    currentNdmi,
    ndmiSlope,
    etMultiplier,
    forecastET,
    etBaseline,
    method: 'universal_kriging_linear_drift',
  }

  if (currentNdmi <= STRESS_THRESHOLD) {
    return { ...base, status: 'critical', daysUntilStress: 0, stressDate: latest.date }
  }

  // Walk the kriged projection forward day by day to the first threshold crossing.
  // effectiveD compresses or stretches the kriging time axis by the ET ratio:
  // at etMultiplier=1.5 the model sees d=1 wall-clock day as 1.5 effective days,
  // pulling the NDMI crossing 33% closer in calendar time.
  let crossing = null
  const band = []
  for (let d = 1; d <= 180; d++) {
    const effectiveD = d * etMultiplier
    const p = model.predict(xLast + effectiveD)
    const date = new Date(parseDate(latest.date).getTime() + d * DAY_MS)
    band.push({
      t: date.getTime(),
      date: fmtDate(date),
      mean: p.mean,
      lower: p.mean - z95 * p.sd,
      upper: p.mean + z95 * p.sd,
    })
    if (crossing === null && p.mean <= STRESS_THRESHOLD) {
      crossing = { days: d, date: fmtDate(date) }
    }
  }

  if (!crossing) {
    return { ...base, status: 'adequate', daysUntilStress: null, stressDate: null, band }
  }
  return {
    ...base,
    status: crossing.days < 14 ? 'warning' : 'ok',
    daysUntilStress: crossing.days,
    stressDate: crossing.date,
    band,
  }
}

// ── chart series: observed history + kriged seasonal forecast ───────────────

function buildSeries(clean, model, today) {
  const lastObs = parseDate(clean[clean.length - 1].date)
  const windowStart = lastObs.getTime() - 270 * DAY_MS // ~9 months of context
  // ~8.5 months ahead — far enough to reach the next winter NDVI peak so the
  // predicted-peak marker lands inside the chart.
  const horizonEnd = lastObs.getTime() + 260 * DAY_MS

  const series = []
  for (let t = windowStart; t <= horizonEnd; t += 5 * DAY_MS) {
    const date = new Date(t)
    const p = model.predict(dayOfYear(fmtDate(date)))
    series.push({
      t,
      date: fmtDate(date),
      mean: p.mean,
      band: [p.mean - z95 * p.sd, p.mean + z95 * p.sd],
      isFuture: t > lastObs.getTime(),
    })
  }

  const observed = clean
    .filter((d) => parseDate(d.date).getTime() >= windowStart)
    .map((d) => ({ t: parseDate(d.date).getTime(), ndvi: d.ndvi_mean }))

  return { series, observed, forecastStart: lastObs.getTime() }
}

// ── public entry point ──────────────────────────────────────────────────────

/**
 * Compute the full kriging-based forecast for a farm's time series.
 * @param {Array}  data        raw time-series records for one farm block
 * @param {object} [weatherData] ET context from fetchWeatherAndET(); null = no adjustment
 * @param {Date}   [now]       reference "today" (defaults to current date)
 */
export function computeForecast(data, weatherData = null, now = new Date()) {
  const clean = cleanData(data)
  if (clean.length < 4) {
    return { harvest: null, irrigation: null, series: [], observed: [], forecastStart: null }
  }
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const ndviModel = seasonalNdviModel(clean)
  const harvest = harvestPeak(clean, ndviModel, today)
  const irrigation = irrigationForecast(clean, today, weatherData)
  const { series, observed, forecastStart } = buildSeries(clean, ndviModel, today)

  // Mark the predicted peak point for the chart (only if it falls in view).
  const peakPoint =
    harvest && series.length
      ? { t: parseDate(harvest.nextPeakDateFull).getTime(), ndvi: harvest.peakNdvi }
      : null

  return { harvest, irrigation, series, observed, forecastStart, peakPoint }
}

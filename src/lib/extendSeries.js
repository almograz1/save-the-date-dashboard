/**
 * Bridge the GEE data gap.
 *
 * The Sentinel-2 export stopped after 2026-04-29, but the dashboard is being
 * used weeks later. Rather than show a stale field, we extend each block's time
 * series up to "today" by sampling the seasonal Ordinary-Kriging model fitted
 * to the measured data (same engine used for forecasting), plus a small
 * deterministic wobble so the continuation looks like real observations.
 *
 * Every synthesized record is flagged `estimated: true` so the UI can keep them
 * visually distinct from measured satellite data — these are modeled fill-ins,
 * not new GEE images.
 */
import { cleanData } from './analytics'
import { krigePredictor, cyclicDist } from './kriging'

const DAY_MS = 86_400_000
const PERIOD = 365
const STEP_DAYS = 5 // Sentinel-2 revisit cadence used elsewhere in the app

const parseDate = (s) => new Date(s + 'T00:00:00Z')
const fmtDate = (d) => d.toISOString().slice(0, 10)
const dayOfYear = (date) => {
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 0)
  return Math.round((date.getTime() - yearStart) / DAY_MS)
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length

// Small seeded wobble so synthesized points aren't a perfectly smooth curve.
const noiseFor = (dateStr, amp) => {
  let h = 0
  for (const c of dateStr) h = (h * 31 + c.charCodeAt(0)) | 0
  const r = ((h ^ (h >>> 15)) >>> 0) / 4_294_967_296 // 0..1
  return (r - 0.5) * 2 * amp
}

/**
 * Return `data` extended with estimated observations up to `now`.
 * If the series already reaches within one step of today, it's returned as-is.
 */
export function extendToToday(data, now = new Date()) {
  const clean = cleanData(data)
  if (clean.length < 4) return data

  const lastDate = parseDate(data[data.length - 1].date)
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  if (today.getTime() - lastDate.getTime() < STEP_DAYS * DAY_MS) return data

  // Seasonal models over the day-of-year cycle, fit on measured data only.
  const ndviModel = krigePredictor(
    clean.map((d) => ({ x: dayOfYear(parseDate(d.date)), z: d.ndvi_mean })),
    { distFn: cyclicDist(PERIOD), drift: 'none' }
  )
  const ndmiModel = krigePredictor(
    clean.map((d) => ({ x: dayOfYear(parseDate(d.date)), z: d.ndmi_mean })),
    { distFn: cyclicDist(PERIOD), drift: 'none' }
  )

  // Typical shape stats, reused to fill the min/max/std fields realistically.
  const avgStd = mean(clean.map((d) => d.ndvi_std ?? 0.02))
  const gapMin = mean(clean.map((d) => d.ndvi_mean - d.ndvi_min))
  const gapMax = mean(clean.map((d) => d.ndvi_max - d.ndvi_mean))
  const ndmiGapMin = mean(clean.map((d) => d.ndmi_mean - (d.ndmi_min ?? d.ndmi_mean)))

  const extended = [...data]
  for (
    let t = lastDate.getTime() + STEP_DAYS * DAY_MS;
    t <= today.getTime();
    t += STEP_DAYS * DAY_MS
  ) {
    const date = new Date(t)
    const ds = fmtDate(date)
    const doy = dayOfYear(date)
    const ndvi = +(ndviModel.predict(doy).mean + noiseFor(ds + 'v', 0.012)).toFixed(4)
    const ndmi = +(ndmiModel.predict(doy).mean + noiseFor(ds + 'm', 0.01)).toFixed(4)
    extended.push({
      date: ds,
      ndvi_mean: ndvi,
      ndvi_min: +(ndvi - gapMin).toFixed(4),
      ndvi_max: +(ndvi + gapMax).toFixed(4),
      ndvi_std: +avgStd.toFixed(4),
      ndmi_mean: ndmi,
      ndmi_min: +(ndmi - ndmiGapMin).toFixed(4),
      cloud_cover: 0, // modeled point — treated as clear so cleanData keeps it
      estimated: true,
    })
  }
  return extended
}

// First date that is modeled rather than measured (for UI markers), or null.
export function firstEstimatedDate(data) {
  const f = data.find((d) => d.estimated)
  return f ? f.date : null
}

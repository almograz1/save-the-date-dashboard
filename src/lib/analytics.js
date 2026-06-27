/**
 * Analytics - computed insights derived from the time series.
 *
 * These functions don't just describe the data; they answer questions
 * a date farmer would actually ask.
 */

const CLOUD_THRESHOLD = 20

// Filter out cloud-contaminated observations
export const cleanData = (data) => data.filter((d) => d.cloud_cover < CLOUD_THRESHOLD)

// Pearson correlation
const pearson = (x, y) => {
  const n = x.length
  const mx = x.reduce((a, b) => a + b, 0) / n
  const my = y.reduce((a, b) => a + b, 0) / n
  const num = x.reduce((acc, xi, i) => acc + (xi - mx) * (y[i] - my), 0)
  const denom = Math.sqrt(
    x.reduce((acc, xi) => acc + (xi - mx) ** 2, 0) *
      y.reduce((acc, yi) => acc + (yi - my) ** 2, 0)
  )
  return denom === 0 ? 0 : num / denom
}

/**
 * Detect persistent stress zone - when ndvi_min consistently lags ndvi_mean
 * by a large gap, it indicates a specific underperforming area.
 */
export const detectStressZone = (data) => {
  const clean = cleanData(data)
  const recent = clean.slice(-20) // last ~3 months
  const gaps = recent.map((d) => d.ndvi_mean - d.ndvi_min)
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
  const persistent = gaps.filter((g) => g > 0.15).length

  return {
    detected: persistent >= recent.length * 0.6,
    persistenceRatio: persistent / recent.length,
    avgGap: avgGap,
    observationsChecked: recent.length,
    severity: avgGap > 0.2 ? 'high' : avgGap > 0.15 ? 'moderate' : 'low',
  }
}

/**
 * Irrigation effectiveness - correlation of NDVI to NDMI.
 * Strong positive = water input drives growth.
 * Weak/negative = something blocks water uptake (salinity, drainage, root rot).
 */
export const irrigationEffectiveness = (data) => {
  const clean = cleanData(data)
  const r = pearson(
    clean.map((d) => d.ndvi_mean),
    clean.map((d) => d.ndmi_mean)
  )
  let assessment
  if (r > 0.7) assessment = 'effective'
  else if (r > 0.4) assessment = 'adequate'
  else if (r > 0.2) assessment = 'weak'
  else assessment = 'concerning'
  return { correlation: r, assessment }
}

/**
 * Field uniformity - coefficient of variation (stdDev / mean).
 * Lower = more uniform field.
 */
export const fieldUniformity = (data) => {
  const clean = cleanData(data)
  const cvs = clean.map((d) => d.ndvi_std / d.ndvi_mean)
  const avgCV = cvs.reduce((a, b) => a + b, 0) / cvs.length
  let rating
  if (avgCV < 0.1) rating = 'excellent'
  else if (avgCV < 0.15) rating = 'good'
  else if (avgCV < 0.25) rating = 'mixed'
  else rating = 'poor'
  // Express as a 0-100 score (inverted: higher = more uniform)
  const score = Math.max(0, Math.min(100, Math.round(100 * (1 - avgCV / 0.3))))
  return { cv: avgCV, rating, score }
}

/**
 * Seasonal phenology - identifies peak and trough months.
 */
export const seasonalPattern = (data) => {
  const clean = cleanData(data)
  const monthly = {}
  for (const d of clean) {
    const month = d.date.slice(0, 7) // YYYY-MM
    if (!monthly[month]) monthly[month] = []
    monthly[month].push(d.ndvi_mean)
  }
  const monthlyAvg = Object.entries(monthly).map(([m, vals]) => ({
    month: m,
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    count: vals.length,
  }))
  monthlyAvg.sort((a, b) => a.month.localeCompare(b.month))

  const peak = monthlyAvg.reduce((max, m) => (m.avg > max.avg ? m : max))
  const trough = monthlyAvg.reduce((min, m) => (m.avg < min.avg ? m : min))

  return { monthlyAvg, peak, trough }
}

/**
 * Find anomalies - observations where NDVI and NDMI move in opposite
 * directions by a meaningful amount. Usually indicates atmospheric
 * contamination or a measurement issue.
 */
export const detectAnomalies = (data) => {
  const clean = cleanData(data)
  const anomalies = []
  for (let i = 1; i < clean.length; i++) {
    const dNdvi = clean[i].ndvi_mean - clean[i - 1].ndvi_mean
    const dNdmi = clean[i].ndmi_mean - clean[i - 1].ndmi_mean
    // Opposite signs and both meaningful
    if (Math.sign(dNdvi) !== Math.sign(dNdmi) && Math.abs(dNdmi) > 0.15) {
      anomalies.push({
        date: clean[i].date,
        ndviChange: dNdvi,
        ndmiChange: dNdmi,
        reason:
          'NDVI and NDMI moved in opposite directions - likely atmospheric contamination',
      })
    }
  }
  return anomalies
}

/**
 * Current state vs seasonal expectation.
 * Compares latest NDVI to the average for the same calendar month
 * (across the available history).
 */
export const currentVsExpected = (data) => {
  const clean = cleanData(data)
  if (clean.length === 0) return null
  const latest = clean[clean.length - 1]
  const latestMonth = latest.date.slice(5, 7) // MM

  const sameMonthHistorical = clean
    .slice(0, -1)
    .filter((d) => d.date.slice(5, 7) === latestMonth)

  if (sameMonthHistorical.length === 0) {
    // No same-month history - compare to overall average instead
    const allAvg = clean.reduce((a, b) => a + b.ndvi_mean, 0) / clean.length
    return {
      latest: latest.ndvi_mean,
      expected: allAvg,
      delta: latest.ndvi_mean - allAvg,
      basis: 'overall_average',
    }
  }
  const expected =
    sameMonthHistorical.reduce((a, b) => a + b.ndvi_mean, 0) /
    sameMonthHistorical.length
  return {
    latest: latest.ndvi_mean,
    expected,
    delta: latest.ndvi_mean - expected,
    basis: 'same_month_historical',
  }
}

/**
 * Predict next irrigation need based on NDMI linear decline rate.
 * Projects when NDMI will fall to ≤ 0.0 (moisture stress threshold).
 */
export const predictNextIrrigation = (data) => {
  const clean = cleanData(data)
  const recent = clean.slice(-8) // ~5 weeks of observations
  if (recent.length < 3) return null

  const xs = recent.map((_, i) => i)
  const ys = recent.map((d) => d.ndmi_mean)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  const num = xs.reduce((acc, xi, i) => acc + (xi - mx) * (ys[i] - my), 0)
  const denom = xs.reduce((acc, xi) => acc + (xi - mx) ** 2, 0)
  const slope = denom === 0 ? 0 : num / denom // NDMI per observation (~5 days)

  const latestNdmi = recent[recent.length - 1].ndmi_mean
  const latestDate = recent[recent.length - 1].date
  const STRESS_THRESHOLD = 0.0

  if (latestNdmi <= STRESS_THRESHOLD) {
    return { status: 'critical', daysUntilStress: 0, stressDate: latestDate, currentNdmi: latestNdmi, ndmiSlope: slope }
  }
  if (slope >= 0) {
    return { status: 'adequate', daysUntilStress: null, stressDate: null, currentNdmi: latestNdmi, ndmiSlope: slope }
  }

  const obsUntilStress = (STRESS_THRESHOLD - latestNdmi) / slope
  const daysUntilStress = Math.round(obsUntilStress * 5)
  const stressDate = new Date(latestDate)
  stressDate.setDate(stressDate.getDate() + daysUntilStress)

  return {
    status: daysUntilStress < 14 ? 'warning' : 'ok',
    daysUntilStress,
    stressDate: stressDate.toISOString().slice(0, 10),
    currentNdmi: latestNdmi,
    ndmiSlope: slope,
  }
}

/**
 * Predict next seasonal NDVI peak based on the historical peak month.
 * For Jordan Valley date palms the peak is in winter (Dec–Feb).
 */
export const predictHarvestPeak = (data) => {
  const { peak } = seasonalPattern(data)
  const peakMonthNum = parseInt(peak.month.split('-')[1])
  const today = new Date()
  const currentMonth = today.getMonth() + 1

  let targetYear = today.getFullYear()
  if (peakMonthNum <= currentMonth) targetYear += 1

  const targetDate = new Date(targetYear, peakMonthNum - 1, 15)
  const daysUntil = Math.round((targetDate - today) / 86_400_000)

  return {
    peakNdvi: peak.avg,
    nextPeakDate: targetDate.toISOString().slice(0, 7),
    daysUntil,
  }
}

/**
 * Trend over the last N observations - is the field improving or declining?
 */
export const recentTrend = (data, n = 6) => {
  const clean = cleanData(data)
  if (clean.length < n) return null
  const recent = clean.slice(-n)
  // Simple linear regression slope
  const xs = recent.map((_, i) => i)
  const ys = recent.map((d) => d.ndvi_mean)
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  const num = xs.reduce((acc, xi, i) => acc + (xi - mx) * (ys[i] - my), 0)
  const denom = xs.reduce((acc, xi) => acc + (xi - mx) ** 2, 0)
  const slope = num / denom // NDVI change per observation (~5 days)
  const direction = slope > 0.005 ? 'rising' : slope < -0.005 ? 'falling' : 'stable'
  return { slope, direction, observations: n }
}

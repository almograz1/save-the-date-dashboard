// NDVI genuinely low for an arid date palm (not just a young block's normal
// baseline). Matches the "needs attention" band in FieldMap so the coaching and
// the map agree, and a low-vigor young block isn't reported as 100% stressed.
const STRESS_NDVI = 0.18

// Derive spatial stress stats from whichever farm's pixelGrid is active.
function spatialStats(pixelGrid) {
  const features = pixelGrid.features
  const allNdvi = features.map((f) => f.properties.NDVI)
  const threshold5pct = [...allNdvi].sort((a, b) => a - b)[
    Math.max(0, Math.floor(allNdvi.length * 0.05) - 1)
  ]
  const worstPixels = features.filter((f) => f.properties.NDVI <= threshold5pct)
  const stressedPixels = features.filter((f) => f.properties.NDVI < STRESS_NDVI)

  const n = features.length
  const allLng = features.reduce((s, f) => s + f.geometry.coordinates[0], 0) / n
  const allLat = features.reduce((s, f) => s + f.geometry.coordinates[1], 0) / n
  const wn = worstPixels.length || 1
  const wLng = worstPixels.reduce((s, f) => s + f.geometry.coordinates[0], 0) / wn
  const wLat = worstPixels.reduce((s, f) => s + f.geometry.coordinates[1], 0) / wn

  const dx = (wLng - allLng) * 94_200
  const dy = (wLat - allLat) * 111_000
  let compass = ''
  if (Math.abs(dy) > 5) compass += dy > 0 ? 'north' : 'south'
  if (Math.abs(dx) > 5) compass += (compass ? '-' : '') + (dx > 0 ? 'east' : 'west')
  if (!compass) compass = 'center'

  return {
    stressedPx: stressedPixels.length,
    stressedArea: stressedPixels.length * 100,
    stressCut: STRESS_NDVI,
    compass,
  }
}

// Assumed drip system efficiency for volume calculations.
const DRIP_EFFICIENCY = 0.90

/**
 * Compute the estimated crop water need (mm) and recommended irrigation volume
 * (L/dunam) from ET forecast data up to daysAhead calendar days.
 * Returns null when ET data is unavailable.
 */
function etWaterVolume(weatherData, daysAhead) {
  if (!weatherData || daysAhead == null || daysAhead <= 0) return null
  const { forecastDays, forecastET, currentKc } = weatherData
  let totalEtcMm = 0
  for (let d = 0; d < daysAhead; d++) {
    const et0 = forecastDays[d]?.et0 ?? forecastET
    totalEtcMm += et0 * currentKc
  }
  // 1 mm of ET over 1 dunam (1,000 m²) equals 1,000 L of water lost.
  // Divide by drip efficiency to get what needs to be applied at the emitter.
  const litersPerDunam = Math.round((totalEtcMm * 1000) / DRIP_EFFICIENCY)
  return { totalEtcMm: +totalEtcMm.toFixed(1), litersPerDunam }
}

/**
 * Format an evaporation anomaly as a human-readable context string, e.g.:
 * "Evaporation: 9.8 mm/day (+24% above June average)"
 */
function etContextLine(weatherData) {
  if (!weatherData?.forecastET) return ''
  const { forecastET, baseline, etAnomalyRatio } = weatherData
  const month = new Date().toLocaleString('en-US', { month: 'long' })
  const pct = Math.round((etAnomalyRatio - 1) * 100)
  const sign = pct >= 0 ? '+' : ''
  return `Evaporation forecast: ${forecastET.toFixed(1)} mm/day (${sign}${pct}% vs ${month} average of ${baseline.toFixed(1)} mm/day). `
}

/**
 * Generate prioritized farm action recommendations from all available signals.
 *
 * Returns an array of recommendation objects, each with:
 *   horizon  - 'now' | 'week' | 'season' | 'longterm'
 *   priority - 'high' | 'medium' | 'low'
 *   category - 'irrigation' | 'inspection' | 'harvest' | 'planting' | 'system'
 *   title    - short imperative label
 *   body     - stat-driven reasoning (the "why")
 *   action   - specific step(s) the farmer should take
 */
export function generateRecommendations({ clean, insights, irrigation, harvest, pixelGrid, weatherData = null }) {
  const {
    stressZone,
    trend,
    uniformity,
    irrigation: irrigEff,
    seasonal,
    currentVsExpected,
  } = insights

  const { stressedPx, stressedArea, stressCut, compass } = spatialStats(pixelGrid)
  const cut = stressCut.toFixed(2)
  const recs = []

  // ── ACT NOW ────────────────────────────────────────────────────────────────

  if (irrigation?.status === 'critical') {
    const vol = etWaterVolume(weatherData, 1)
    const etLine = etContextLine(weatherData)
    const volLine = vol
      ? ` Estimated immediate water need: ${vol.totalEtcMm} mm (${vol.litersPerDunam.toLocaleString()} L/dunam) to replenish today's crop demand.`
      : ''
    recs.push({
      id: 'irrigate-now',
      horizon: 'now',
      priority: 'high',
      category: 'irrigation',
      title: 'Irrigate immediately',
      body: `NDMI is ${irrigation.currentNdmi.toFixed(3)} — already at or below the moisture stress threshold (0.0). Trees are under active water deficit right now. ${etLine}${volLine}`,
      action: 'Open the irrigation system today. Before starting, walk the drip lines and clear any clogged emitters — a blocked emitter during a crisis irrigation makes the stressed zone worse.',
    })
  } else if (irrigation?.status === 'warning') {
    const vol = etWaterVolume(weatherData, irrigation.daysUntilStress)
    const etLine = etContextLine(weatherData)
    const volLine = vol
      ? ` Estimated crop water loss until stress date: ${vol.totalEtcMm} mm. Recommended irrigation dose: ${vol.litersPerDunam.toLocaleString()} L/dunam (90% drip efficiency assumed).`
      : ''
    const etAccel = irrigation.etMultiplier > 1.1
      ? ` ⚡ High evaporation is speeding up soil moisture loss — irrigation date moved earlier than the satellite trend alone would suggest.`
      : ''
    recs.push({
      id: 'irrigate-soon',
      horizon: 'now',
      priority: 'high',
      category: 'irrigation',
      title: `Irrigate within ${irrigation.daysUntilStress} days`,
      body: `NDMI is declining at ${irrigation.ndmiSlope.toFixed(4)} per 5-day observation. Soil moisture will hit the stress threshold (NDMI = 0.0) around ${irrigation.stressDate}. Current NDMI: ${irrigation.currentNdmi.toFixed(3)}.${etAccel} ${etLine}${volLine}`,
      action: `Schedule the next irrigation cycle no later than ${irrigation.stressDate}. Pre-check drip pressure in the ${compass} zone where NDVI is already lowest.`,
    })
  }

  if (trend?.direction === 'falling') {
    recs.push({
      id: 'trend-falling',
      horizon: 'now',
      priority: stressZone.detected ? 'high' : 'medium',
      category: 'inspection',
      title: 'NDVI falling - physical verification needed',
      body: `Vegetation index has trended downward over the last ${trend.observations} satellite observations (linear slope: ${trend.slope.toFixed(4)} NDVI per observation, ~${(trend.slope / 5 * 30).toFixed(3)} per month). Could be seasonal dormancy entry or an emerging problem.`,
      action: `Compare the current month's position in the Seasonal Pattern chart. If approaching a normal summer trough, no action needed. If in or entering the winter growing window and NDVI is still falling, do a full field walk within 5 days.`,
    })
  }

  if (stressZone.detected) {
    recs.push({
      id: 'stress-zone-walk',
      horizon: 'now',
      priority: 'high',
      category: 'inspection',
      title: `Walk the ${compass} zone today (${stressedArea} m²)`,
      body: `${stressedPx} pixels (${stressedArea} m² - roughly ${stressedPx} trees at standard spacing) in the ${compass} part of the field are below NDVI ${cut} - genuinely low even for date palms. The mean-to-min NDVI gap has exceeded the concern threshold in ${(stressZone.persistenceRatio * 100).toFixed(0)}% of the last ${stressZone.observationsChecked} observations. This is not noise - it is a persistent spatial pattern.`,
      action: `Go to the ${compass} cluster. Check in order: (1) drip emitters - are they flowing? (2) soil surface - salt crust or waterlogging? (3) frond color - yellowing tips signal N or K deficiency; brown midrib = potassium. (4) root zone - dig 20cm and check for root rot or nematode damage. Document with photos for before/after comparison.`,
    })
  }

  if (currentVsExpected?.delta < -0.025) {
    recs.push({
      id: 'below-seasonal',
      horizon: 'week',
      priority: 'medium',
      category: 'inspection',
      title: 'NDVI below historical expectation for this month',
      body: `Current NDVI (${currentVsExpected.latest.toFixed(3)}) is ${(Math.abs(currentVsExpected.delta) * 100).toFixed(1)}% below the historical average for this calendar month (${currentVsExpected.expected.toFixed(3)}), based on ${currentVsExpected.basis === 'same_month_historical' ? 'all prior same-month observations' : 'the overall dataset average'}.`,
      action: "Pull up last year's NDVI chart for the same month using the date range filter and compare. If the gap is consistent across the whole field (not just the stressed cluster), consider a soil nutrient test - nitrogen deficiency is the most common cause of a field-wide NDVI shortfall.",
    })
  }

  // ── THIS SEASON ─────────────────────────────────────────────────────────────

  if (harvest && harvest.daysUntil > 0 && harvest.daysUntil < 200) {
    const peakLabel = new Date(harvest.nextPeakDate + '-01').toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
    const prepDate = new Date(harvest.nextPeakDate + '-01')
    prepDate.setDate(prepDate.getDate() - 42)
    const prepLabel = prepDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

    recs.push({
      id: 'peak-prep',
      horizon: 'season',
      priority: harvest.daysUntil < 60 ? 'high' : 'medium',
      category: 'harvest',
      title: `Prepare for peak growing window - ${peakLabel}`,
      body: `Historical NDVI peaks at ${harvest.peakNdvi.toFixed(3)} in the winter growing window. The next peak is ~${harvest.daysUntil} days away. Peak NDVI aligns with maximum carbohydrate translocation into developing fruit bunches.`,
      action: `By ${prepLabel} (6 weeks before peak): (1) apply potassium sulfate (2-3 kg/tree) to support fruit fill and frost tolerance. (2) Raise irrigation frequency by 15-20% to meet elevated transpiration demand. (3) Remove any dead or diseased fronds that would waste photosynthate. Do not prune productive green fronds during the peak window.`,
    })
  }

  if (seasonal?.peak) {
    const peakMonthNum = parseInt(seasonal.peak.month.split('-')[1])
    const isWinterPeak = peakMonthNum >= 11 || peakMonthNum <= 2
    if (isWinterPeak) {
      const troughLabel = new Date(
        '2000-' + String(parseInt(seasonal.trough.month.split('-')[1])).toString().padStart(2, '0') + '-01'
      ).toLocaleDateString('en-US', { month: 'long' })

      recs.push({
        id: 'winter-peak-strategy',
        horizon: 'season',
        priority: 'medium',
        category: 'planting',
        title: 'Optimize inputs for the winter growth cycle',
        body: `Date palms in Jordan Valley run an inverted phenology: winter peak NDVI ${seasonal.peak.avg.toFixed(3)}, summer trough ${seasonal.trough.avg.toFixed(3)} (${troughLabel}), amplitude ${(seasonal.peak.avg - seasonal.trough.avg).toFixed(3)}. Summer dormancy is physiological - not a crisis.`,
        action: 'Oct-Nov: front-load fertilization (nitrogen + phosphorus) to fuel the winter flush. Dec-Feb: no pruning, no soil disturbance. Mar-Apr: reduce irrigation by 30% as dormancy begins. May-Sep: minimal water, no nitrogen - over-feeding dormant palms burns roots and wastes input.',
      })
    }
  }

  // ── LONG TERM ───────────────────────────────────────────────────────────────

  if (stressedPx > 0) {
    recs.push({
      id: 'soil-test-replant',
      horizon: 'longterm',
      priority: 'medium',
      category: 'planting',
      title: `Soil test + replanting plan for ${stressedArea} m² (${compass} cluster)`,
      body: `The ${stressedPx} pixels (${stressedArea} m²) in the ${compass} zone are below NDVI ${cut} in the latest snapshot and show up as a chronic stress pattern over time. At standard 8x8m spacing that is roughly ${stressedPx} trees. Carrying these underperformers for another season costs more in inputs than replanting would.`,
      action: `Season 1 - Diagnose: collect soil cores from 3 spots in the cluster (0-30cm and 30-60cm). Test for EC (salinity), pH, Boron, N, P, K. If salinity > 6 dS/m: flush zone with 3x normal irrigation volume over 4 weeks. Season 2 - If trees remain below NDVI 0.28 after treatment: replace with certified disease-free offshoots of your best-performing variety. Plant in autumn to give roots 2 winters to establish before fruit load.`,
    })
  }

  if (irrigEff.correlation < 0.55) {
    recs.push({
      id: 'drip-system-audit',
      horizon: 'longterm',
      priority: 'medium',
      category: 'system',
      title: 'Drip system efficiency audit',
      body: `NDVI-to-NDMI correlation is ${irrigEff.correlation.toFixed(2)} - below the 0.7 threshold expected for a well-functioning drip system. Water delivery and vegetation response are decoupled, meaning water is running but not reaching where trees need it.`,
      action: `Hire an irrigation technician for a full emitter audit. Map discharge rate variance across the field (target: < 10% coefficient of variation). Replace emitters older than 4 years in the stressed zone first. Consider switching the ${stressedArea} m² cluster to pressure-compensated emitters (2 L/hr) to ensure even delivery regardless of elevation changes.`,
    })
  }

  if (uniformity.rating === 'mixed' || uniformity.rating === 'poor') {
    recs.push({
      id: 'zone-management',
      horizon: 'longterm',
      priority: 'low',
      category: 'planting',
      title: 'Introduce zone-based field management',
      body: `Field uniformity is "${uniformity.rating}" (coefficient of variation = ${uniformity.cv.toFixed(3)}). With this level of variation, a single irrigation or fertilization schedule applied uniformly is over-serving some trees and under-serving others.`,
      action: `Divide the field into 3 management zones based on the NDVI heatmap: Healthy (NDVI ≥ 0.30), Establishing (0.18-0.30), Needs attention (< ${cut}). Run independent fertilization and irrigation programs per zone for 2 full seasons. A well-managed zoned farm typically narrows CV to below 0.10 within 2-3 years.`,
    })
  }

  // Sort: high priority first, then by horizon order
  const horizonOrder = { now: 0, week: 1, season: 2, longterm: 3 }
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  recs.sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority])
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    return horizonOrder[a.horizon] - horizonOrder[b.horizon]
  })

  return recs
}

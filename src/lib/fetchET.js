// Farm centroid for the Naama complex, Jordan Valley (derived from farms.json polygons)
const FARM_LAT = 31.905
const FARM_LON = 35.479

// ERA5-Land climatological ETo baseline for this location (mm/day, Jan–Dec).
// Source: ECMWF ERA5-Land 1991–2020 climatology at lat 31.9 / lon 35.48.
// Jordan Valley is hyper-arid; summer values are high due to low humidity and intense radiation.
const MONTHLY_BASELINE = [2.8, 3.5, 5.0, 6.8, 8.2, 9.5, 9.8, 9.2, 7.5, 5.6, 3.6, 2.7]

// FAO-56 crop coefficient for date palms by month (adapted for Jordan Valley phenology).
// Winter dormancy (Nov–Feb) pulls Kc to ~0.65; peak fruit-fill demand (Jun–Aug) reaches 0.95.
const MONTHLY_KC = [0.65, 0.65, 0.80, 0.85, 0.90, 0.95, 0.95, 0.95, 0.90, 0.85, 0.70, 0.65]

export const getMonthlyBaseline = (month) => MONTHLY_BASELINE[month]
export const getDatePalmKc = (month) => MONTHLY_KC[month]

/**
 * Fetch reference evapotranspiration (ETo) and temperature for the farm via Open-Meteo.
 * Returns the past 14 days + next 7-day forecast, plus a pre-computed ET anomaly ratio
 * (forecastET / monthly baseline) that forecast.js uses to accelerate the NDMI kriging.
 *
 * Open-Meteo is free and requires no API key. The `et0_fao_evapotranspiration` field is
 * the FAO-56 Penman-Monteith reference ET computed from ERA5 reanalysis inputs — the same
 * underlying dataset we'd get by running ECMWF/ERA5_LAND in GEE, but served live.
 */
export async function fetchWeatherAndET() {
  const params = new URLSearchParams({
    latitude: FARM_LAT,
    longitude: FARM_LON,
    daily: 'et0_fao_evapotranspiration,temperature_2m_max,temperature_2m_min',
    timezone: 'Asia/Jerusalem',
    past_days: '14',
    forecast_days: '7',
  })

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) throw new Error(`Open-Meteo fetch failed: ${res.status}`)
  const json = await res.json()

  const today = new Date().toISOString().slice(0, 10)
  const days = json.daily.time.map((date, i) => ({
    date,
    et0: json.daily.et0_fao_evapotranspiration[i] ?? 0,
    tempMax: json.daily.temperature_2m_max[i] ?? null,
    tempMin: json.daily.temperature_2m_min[i] ?? null,
    isForecast: date > today,
  }))

  const currentMonth = new Date().getMonth()
  const baseline = MONTHLY_BASELINE[currentMonth]
  const currentKc = MONTHLY_KC[currentMonth]

  const forecastDays = days.filter((d) => d.isForecast)
  const pastDays = days.filter((d) => !d.isForecast)

  // Use the forecast mean ET (what's coming) for the drift acceleration decision.
  const forecastET =
    forecastDays.length > 0
      ? forecastDays.reduce((s, d) => s + d.et0, 0) / forecastDays.length
      : baseline

  // Recent observed ET (last 7 days) — used for display / anomaly description.
  const recent = pastDays.slice(-7)
  const recentET = recent.length > 0
    ? recent.reduce((s, d) => s + d.et0, 0) / recent.length
    : baseline

  // Ratio > 1 → hotter/drier than average; ratio < 1 → cooler/more humid.
  const etAnomalyRatio = forecastET / baseline

  return {
    days,
    forecastDays,
    pastDays,
    recentET,
    forecastET,
    baseline,
    etAnomalyRatio,
    currentKc,
    currentMonth,
  }
}

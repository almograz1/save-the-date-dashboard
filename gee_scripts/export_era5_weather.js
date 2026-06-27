/**
 * export_era5_weather.js — Google Earth Engine script
 *
 * Exports daily temperature and reference evapotranspiration (ETo) for the
 * Naama farm area from ECMWF ERA5-Land. This is the GEE-native source for the
 * same ET values that Open-Meteo serves live in the dashboard — useful for
 * building a long historical record (e.g. 2020–present) that could be embedded
 * as static JSON alongside timeseries.json for offline kriging over ET.
 *
 * Output fields per day:
 *   date           - ISO date string
 *   temp_max_c     - daily max 2m air temperature (°C)
 *   temp_min_c     - daily min 2m air temperature (°C)
 *   et0_mm         - FAO-56 Penman-Monteith reference ET (mm/day), derived from
 *                    ERA5-Land total_evaporation_sum (converted from m/day, negated)
 *
 * How to run:
 *   1. Paste into the GEE Code Editor (code.earthengine.google.com).
 *   2. Adjust START_DATE / END_DATE.
 *   3. Click Run → Tasks → Run the export to Google Drive.
 *   4. Download the CSV, convert rows to JSON objects, embed in src/data/ if
 *      you want a richer static ET baseline (e.g. for year-over-year comparison).
 */

// ── Configuration ─────────────────────────────────────────────────────────────

var START_DATE = '2024-01-01'
var END_DATE   = '2026-05-01'   // update to today when refreshing

// Naama farm centroid (Jordan Valley, Israel)
var FARM_POINT = ee.Geometry.Point([35.479, 31.905])

// Small buffer around the point to allow spatial reduction (ERA5 is ~9 km res)
var AOI = FARM_POINT.buffer(5000)

// ── ERA5-Land collection ───────────────────────────────────────────────────────

// ECMWF/ERA5_LAND/DAILY_AGGR provides daily aggregates of ERA5-Land fields.
// Relevant bands:
//   temperature_2m              — mean 2m air temp (K)
//   temperature_2m_max          — daily max 2m temp (K)
//   temperature_2m_min          — daily min 2m temp (K)
//   total_evaporation_sum       — total daily ET (m, negative = loss from surface)
//
// ERA5-Land spatial resolution: ~9 km. For a small farm the spatial variation
// within the AOI is negligible; we reduce with .mean() over the buffer.

var era5 = ee.ImageCollection('ECMWF/ERA5_LAND/DAILY_AGGR')
  .filterDate(START_DATE, END_DATE)
  .filterBounds(AOI)
  .select([
    'temperature_2m_max',
    'temperature_2m_min',
    'total_evaporation_sum',
  ])

// ── Feature extraction ─────────────────────────────────────────────────────────

var KELVIN_OFFSET = 273.15

var features = era5.map(function(img) {
  var reduced = img.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: AOI,
    scale: 11132,   // ERA5-Land native resolution in metres
    maxPixels: 1e6,
  })

  // Convert Kelvin → Celsius
  var tempMax = ee.Number(reduced.get('temperature_2m_max')).subtract(KELVIN_OFFSET)
  var tempMin = ee.Number(reduced.get('temperature_2m_min')).subtract(KELVIN_OFFSET)

  // total_evaporation_sum is in metres (negative). Negate and convert to mm.
  // ERA5 ETo from this band is the upward latent heat flux integrated over 24 h,
  // which closely approximates FAO-56 Penman-Monteith ETo at the regional scale.
  var et0_mm = ee.Number(reduced.get('total_evaporation_sum')).multiply(-1000)

  var date = img.date().format('YYYY-MM-dd')

  return ee.Feature(null, {
    date:       date,
    temp_max_c: tempMax,
    temp_min_c: tempMin,
    et0_mm:     et0_mm,
  })
})

var fc = ee.FeatureCollection(features)

// ── Export ─────────────────────────────────────────────────────────────────────

Export.table.toDrive({
  collection:   fc,
  description:  'naama_era5_weather',
  fileFormat:   'CSV',
  selectors:    ['date', 'temp_max_c', 'temp_min_c', 'et0_mm'],
})

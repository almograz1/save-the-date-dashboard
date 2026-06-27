// =====================================================================
// EXPORT NDVI/NDMI/SAVI/BSI TIME SERIES FOR ONE BLOCK
// Run this in https://code.earthengine.google.com
// =====================================================================
// This is the missing companion to export_pixel_grid.js. It refreshes the
// app's time series — there is NO live Sentinel-2 feed; the dashboard reads a
// static JSON, so when it looks stale you re-run THIS and replace the file.
//
// Output columns map 1:1 to the fields the app reads in src/data/*.json:
//   date, ndvi_mean, ndvi_min, ndvi_max, ndvi_std,
//   ndmi_mean, ndmi_min, ndmi_max, savi_mean, bsi_mean, cloud_cover
// =====================================================================

// Naama 3 (the real block). Swap coordinates to export another block.
var FARM_POLYGON = ee.Geometry.Polygon([[
  [35.4790031, 31.9061052], [35.4790231, 31.9061074], [35.4778847, 31.9060186],
  [35.4778256, 31.9059344], [35.4779007, 31.9058615], [35.4778310, 31.9057818],
  [35.4779168, 31.9057317], [35.4778498, 31.9056315], [35.4779517, 31.9055837],
  [35.4778793, 31.9055154], [35.4780107, 31.9053788], [35.4779651, 31.9053059],
  [35.4780375, 31.9052422], [35.4780000, 31.9051739], [35.4780697, 31.9051033],
  [35.4780322, 31.9049780], [35.4780322, 31.9048824], [35.4790460, 31.9049621],
  [35.4790729, 31.9051556], [35.4791492, 31.9053947], [35.4791706, 31.9055427],
  [35.4791170, 31.9056315], [35.4791572, 31.9057021], [35.4791197, 31.9057545],
  [35.4791304, 31.9058296], [35.4790219, 31.9059412], [35.4790541, 31.9060004],
  [35.4790031, 31.9061052]
]]);

// Pull from the start of the existing record up to today.
// Bump END_DATE whenever you re-run (or set it past today — future images are
// simply ignored). Keep START_DATE to extend the same continuous series.
var START_DATE = '2025-05-01';
var END_DATE   = '2026-07-01';   // ← set to "today or later" when refreshing

// Keep images at least this cloudy out entirely (the app also filters >= 20%).
var MAX_CLOUD = 60;

// ============ HELPERS ============
function maskS2clouds(image) {
  var qa = image.select('QA60');
  var mask = qa.bitwiseAnd(1 << 10).eq(0).and(qa.bitwiseAnd(1 << 11).eq(0));
  // Scale reflectance to 0–1 (SAVI's +0.5 and BSI assume real reflectance).
  return image.updateMask(mask).divide(10000)
    .copyProperties(image, ['system:time_start', 'CLOUDY_PIXEL_PERCENTAGE']);
}

function addIndices(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  var ndmi = image.normalizedDifference(['B8', 'B11']).rename('NDMI');
  var savi = image.expression(
    '1.5 * ((NIR - RED) / (NIR + RED + 0.5))',
    { NIR: image.select('B8'), RED: image.select('B4') }
  ).rename('SAVI');
  // BSI = ((SWIR1 + RED) - (NIR + BLUE)) / ((SWIR1 + RED) + (NIR + BLUE))
  var bsi = image.expression(
    '((SWIR + RED) - (NIR + BLUE)) / ((SWIR + RED) + (NIR + BLUE))',
    {
      SWIR: image.select('B11'), RED: image.select('B4'),
      NIR: image.select('B8'), BLUE: image.select('B2'),
    }
  ).rename('BSI');
  return image.addBands([ndvi, ndmi, savi, bsi]);
}

// One row per image: reduce the four indices over the polygon.
function summarize(image) {
  var stats = image.select(['NDVI', 'NDMI', 'SAVI', 'BSI']).reduceRegion({
    reducer: ee.Reducer.mean()
      .combine(ee.Reducer.minMax(), '', true)
      .combine(ee.Reducer.stdDev(), '', true),
    geometry: FARM_POLYGON,
    scale: 10,
    maxPixels: 1e9,
  });
  return ee.Feature(null, {
    date: image.date().format('YYYY-MM-dd'),
    ndvi_mean: stats.get('NDVI_mean'),
    ndvi_min: stats.get('NDVI_min'),
    ndvi_max: stats.get('NDVI_max'),
    ndvi_std: stats.get('NDVI_stdDev'),
    ndmi_mean: stats.get('NDMI_mean'),
    ndmi_min: stats.get('NDMI_min'),
    ndmi_max: stats.get('NDMI_max'),
    savi_mean: stats.get('SAVI_mean'),
    bsi_mean: stats.get('BSI_mean'),
    cloud_cover: image.get('CLOUDY_PIXEL_PERCENTAGE'),
  });
}

// ============ BUILD THE SERIES ============
var collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate(START_DATE, END_DATE)
  .filterBounds(FARM_POLYGON)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', MAX_CLOUD))
  .map(maskS2clouds)
  .map(addIndices);

var rows = ee.FeatureCollection(collection.map(summarize))
  // Drop images where clouds masked the whole polygon (no NDVI).
  .filter(ee.Filter.notNull(['ndvi_mean']));

print('Observations in range:', rows.size());
print('Latest available image date:',
  ee.Date(collection.aggregate_max('system:time_start')).format('YYYY-MM-dd'));

// ============ EXPORT ============
var ORDER = ['date', 'ndvi_mean', 'ndvi_min', 'ndvi_max', 'ndvi_std',
             'ndmi_mean', 'ndmi_min', 'ndmi_max', 'savi_mean', 'bsi_mean',
             'cloud_cover'];
Export.table.toDrive({
  collection: rows,
  description: 'date_farm_timeseries',
  fileFormat: 'CSV',
  folder: 'GEE_exports',
  selectors: ORDER,
});

print('▶ Run, then open the Tasks tab → Run the export.');
print('▶ The CSV columns already match the app JSON fields. Convert CSV → a');
print('  JSON array of row objects and replace src/data/timeseries.json.');

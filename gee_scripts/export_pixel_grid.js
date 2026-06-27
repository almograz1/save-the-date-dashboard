// =====================================================================
// EXPORT PER-PIXEL VEGETATION DATA FOR HEATMAP
// Run this in https://code.earthengine.google.com
// =====================================================================
// This complements the time-series export by giving you ONE recent
// cloudless image with NDVI/NDMI/SAVI sampled at every Sentinel-2 pixel.
// The output GeoJSON drops directly into the React app's pixel_grid.json.
// =====================================================================

var FARM_POLYGON = ee.Geometry.Polygon([[
  [35.4790031, 31.9061052],
  [35.4790231, 31.9061074],
  [35.4778847, 31.9060186],
  [35.4778256, 31.9059344],
  [35.4779007, 31.9058615],
  [35.4778310, 31.9057818],
  [35.4779168, 31.9057317],
  [35.4778498, 31.9056315],
  [35.4779517, 31.9055837],
  [35.4778793, 31.9055154],
  [35.4780107, 31.9053788],
  [35.4779651, 31.9053059],
  [35.4780375, 31.9052422],
  [35.4780000, 31.9051739],
  [35.4780697, 31.9051033],
  [35.4780322, 31.9049780],
  [35.4780322, 31.9048824],
  [35.4790460, 31.9049621],
  [35.4790729, 31.9051556],
  [35.4791492, 31.9053947],
  [35.4791706, 31.9055427],
  [35.4791170, 31.9056315],
  [35.4791572, 31.9057021],
  [35.4791197, 31.9057545],
  [35.4791304, 31.9058296],
  [35.4790219, 31.9059412],
  [35.4790541, 31.9060004],
  [35.4790031, 31.9061052]
]]);

// Window: pull the most recent ~30 days, take the cleanest single image
var END_DATE = '2026-05-10';
var START_DATE = '2026-04-10';

// ============ HELPERS ============
function maskS2clouds(image) {
  var qa = image.select('QA60');
  var mask = qa.bitwiseAnd(1 << 10).eq(0)
    .and(qa.bitwiseAnd(1 << 11).eq(0));
  return image.updateMask(mask).divide(10000)
    .copyProperties(image, ['system:time_start', 'CLOUDY_PIXEL_PERCENTAGE']);
}

function addIndices(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  var ndmi = image.normalizedDifference(['B8', 'B11']).rename('NDMI');
  var savi = image.expression(
    '((NIR - RED) / (NIR + RED + 0.5)) * 1.5',
    {NIR: image.select('B8'), RED: image.select('B4')}
  ).rename('SAVI');
  return image.addBands([ndvi, ndmi, savi]);
}

// ============ FIND BEST RECENT IMAGE ============
var collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate(START_DATE, END_DATE)
  .filterBounds(FARM_POLYGON)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .map(maskS2clouds)
  .map(addIndices)
  .sort('CLOUDY_PIXEL_PERCENTAGE');

print('Candidate images:', collection.size());
var image = ee.Image(collection.first());
print('Selected image date:', image.date().format('YYYY-MM-dd'));
print('Cloud cover:', image.get('CLOUDY_PIXEL_PERCENTAGE'));

// ============ SAMPLE EVERY PIXEL ============
var pixels = image
  .select(['NDVI', 'NDMI', 'SAVI'])
  .clip(FARM_POLYGON)
  .sample({
    region: FARM_POLYGON,
    scale: 10,
    geometries: true,
    projection: 'EPSG:4326'
  });

print('Pixels sampled:', pixels.size());

// ============ MAP PREVIEW ============
Map.centerObject(FARM_POLYGON, 18);
Map.addLayer(image, {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3}, 'RGB');
Map.addLayer(image.select('NDVI').clip(FARM_POLYGON), {
  min: 0.15, max: 0.40,
  palette: ['#a50026','#d73027','#f46d43','#fdae61','#fee08b',
            '#d9ef8b','#a6d96a','#66bd63','#1a9850']
}, 'NDVI heatmap');
Map.addLayer(FARM_POLYGON, {color: 'white'}, 'Polygon');

// ============ EXPORT ============
Export.table.toDrive({
  collection: pixels,
  description: 'date_farm_pixel_grid',
  fileFormat: 'GeoJSON',
  folder: 'GEE_exports'
});

print('▶ After running, click the Tasks tab → Run the export.');
print('▶ Open the GeoJSON file and replace src/data/pixel_grid.json');
print('  (You may need to wrap the FeatureCollection in a metadata object,');
print('   or update the React component to read raw GeoJSON.)');

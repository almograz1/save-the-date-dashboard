const STEP_LAT = 10 / 111_320   // degrees per 10 m (latitude)
const STEP_LNG = 10 / 94_200    // degrees per 10 m at ~32 N (longitude)

// Ray-casting point-in-polygon (px=lng, py=lat)
function pip(px, py, ring) {
  let inside = false
  let j = ring.length - 1
  for (let i = 0; i < ring.length; i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside
    j = i
  }
  return inside
}

// Mulberry32 seeded RNG — reproducible per farm
function makeRng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/**
 * Build a synthetic pixel-grid FeatureCollection from a farm definition.
 * farm = { id, name, polygon, ndviBase, ndviRange, ndmiRatio }
 */
export function generatePixelGrid(farm) {
  const { polygon, ndviBase, ndviRange, ndmiRatio, name, id } = farm
  const rand = makeRng(farm.id.split('').reduce((h, c) => h * 31 + c.charCodeAt(0), 0))

  const lngs = polygon.map((c) => c[0])
  const lats = polygon.map((c) => c[1])
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const cLng = lngs.reduce((s, v) => s + v, 0) / lngs.length
  const cLat = lats.reduce((s, v) => s + v, 0) / lats.length

  const features = []
  for (let lat = minLat + STEP_LAT / 2; lat <= maxLat + STEP_LAT * 0.1; lat += STEP_LAT) {
    for (let lng = minLng + STEP_LNG / 2; lng <= maxLng + STEP_LNG * 0.1; lng += STEP_LNG) {
      if (!pip(lng, lat, polygon)) continue

      const dLng = (lng - cLng) * 94_200
      const dLat = (lat - cLat) * 111_000
      const dist = Math.sqrt(dLng * dLng + dLat * dLat)

      const gradient = -0.00012 * dist
      const noise = (rand() - 0.5) * ndviRange
      const ndvi = Math.max(0.05, Math.min(0.7, ndviBase + gradient + noise))
      const ndmi = Math.max(-0.12, Math.min(0.3, ndvi * ndmiRatio + (rand() - 0.5) * 0.014))
      const savi = (1.5 * ndvi) / (ndvi + 0.5)

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [+lng.toFixed(8), +lat.toFixed(8)] },
        id: String(features.length),
        properties: {
          NDVI: +ndvi.toFixed(4),
          NDMI: +ndmi.toFixed(4),
          SAVI: +savi.toFixed(4),
        },
      })
    }
  }

  const ndvis = features.map((f) => f.properties.NDVI)
  return {
    type: 'FeatureCollection',
    metadata: {
      farm: name,
      pixel_count: features.length,
      image_date: '2026-04-28',
      ndvi_min: +Math.min(...ndvis).toFixed(4),
      ndvi_max: +Math.max(...ndvis).toFixed(4),
      source: id === 'naama3' ? 'Real GEE export (Naama 3)' : 'SYNTHETIC - GEE export pending',
    },
    features,
  }
}

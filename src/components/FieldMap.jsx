import { useState, useMemo } from 'react'
import {
  MapContainer,
  TileLayer,
  Polygon,
  Rectangle,
  Tooltip,
  LayersControl,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import './FieldMap.css'

// Absolute color ramps, FARM-WIDE so the four blocks stay directly comparable
// (a young low-vigor block reads lower than a mature one — that is true and
// useful). Calibrated to arid Jordan-Valley date-palm ranges, NOT dense-crop
// thresholds: "below average" is reserved for genuinely low NDVI, so a young
// establishing block isn't mislabeled as severe stress. One ramp per index.
const RAMPS = {
  NDVI: [
    { lt: 0.18, color: '#a50026', label: 'Poor' },
    { lt: 0.22, color: '#d73027', label: 'Low' },
    { lt: 0.26, color: '#f46d43', label: 'Below avg' },
    { lt: 0.30, color: '#fdae61', label: 'Moderate' },
    { lt: 0.34, color: '#a6d96a', label: 'Fair' },
    { lt: 0.38, color: '#66bd63', label: 'Healthy' },
    { lt: Infinity, color: '#1a9850', label: 'Vigorous' },
  ],
  // NDMI (canopy moisture) runs low in this arid setting (~0.0–0.07).
  NDMI: [
    { lt: 0.01, color: '#a50026', label: 'Very dry' },
    { lt: 0.02, color: '#d73027', label: 'Dry' },
    { lt: 0.03, color: '#f46d43', label: 'Low' },
    { lt: 0.04, color: '#fdae61', label: 'Moderate' },
    { lt: 0.05, color: '#a6d96a', label: 'Fair' },
    { lt: 0.06, color: '#66bd63', label: 'Moist' },
    { lt: Infinity, color: '#1a9850', label: 'Well-watered' },
  ],
}

const colorFor = (value, metric) => {
  for (const stop of RAMPS[metric]) {
    if (value < stop.lt) return stop.color
  }
  return RAMPS[metric][RAMPS[metric].length - 1].color
}

// Absolute, date-palm-honest NDVI bands for the summary stats.
// Below 0.18 = genuinely concerning; 0.30+ = healthy mature-canopy vigor.
const NDVI_ATTENTION = 0.18
const NDVI_HEALTHY = 0.30

const HALF_LAT = 5 / 111_000
const HALF_LNG = 5 / 94_200

function pixelBounds([lng, lat]) {
  return [
    [lat - HALF_LAT, lng - HALF_LNG],
    [lat + HALF_LAT, lng + HALF_LNG],
  ]
}

function centroidOf(latLngs) {
  return latLngs.reduce(
    (acc, [lat, lng]) => [acc[0] + lat / latLngs.length, acc[1] + lng / latLngs.length],
    [0, 0]
  )
}

/**
 * pixelGrid  - FeatureCollection for the selected farm
 * farm       - selected farm object { id, name, color, polygon, ... }
 * allFarms   - all 4 farm objects (for drawing outlines of non-selected farms)
 */
function FieldMap({ pixelGrid, farm, allFarms }) {
  const [metric, setMetric] = useState('NDVI')

  const polygonLatLng = farm.polygon.map(([lng, lat]) => [lat, lng])
  const centroid = centroidOf(polygonLatLng)

  const spatialStats = useMemo(() => {
    const ndviValues = pixelGrid.features.map((f) => f.properties.NDVI)
    const total = ndviValues.length
    let healthy = 0, moderate = 0, stressed = 0
    for (const v of ndviValues) {
      if (v >= NDVI_HEALTHY) healthy++
      else if (v < NDVI_ATTENTION) stressed++
      else moderate++
    }
    const blockMean = ndviValues.reduce((a, b) => a + b, 0) / total

    const threshold = [...ndviValues].sort((a, b) => a - b)[
      Math.max(0, Math.floor(total * 0.05) - 1)
    ]
    const worstPixels = pixelGrid.features.filter((f) => f.properties.NDVI <= threshold)
    const stressLng = worstPixels.reduce((s, f) => s + f.geometry.coordinates[0], 0) / worstPixels.length
    const stressLat = worstPixels.reduce((s, f) => s + f.geometry.coordinates[1], 0) / worstPixels.length
    const allLng = pixelGrid.features.reduce((s, f) => s + f.geometry.coordinates[0], 0) / total
    const allLat = pixelGrid.features.reduce((s, f) => s + f.geometry.coordinates[1], 0) / total

    const dxMeters = (stressLng - allLng) * 94_200
    const dyMeters = (stressLat - allLat) * 111_000
    let compass = ''
    if (Math.abs(dyMeters) > 5) compass += dyMeters > 0 ? 'N' : 'S'
    if (Math.abs(dxMeters) > 5) compass += dxMeters > 0 ? 'E' : 'W'
    if (!compass) compass = 'center'

    return {
      total, healthy, moderate, stressed,
      blockMean,
      healthyPct: Math.round((healthy / total) * 100),
      moderatePct: Math.round((moderate / total) * 100),
      stressedPct: Math.round((stressed / total) * 100),
      stressArea: stressed * 100,
      stressDirection: compass,
    }
  }, [pixelGrid])

  const pixelRects = useMemo(
    () => {
      return pixelGrid.features.map((f, i) => {
        const value = f.properties[metric]
        const fillColor = colorFor(value, metric)
        return (
          <Rectangle
            key={i}
            bounds={pixelBounds(f.geometry.coordinates)}
            pathOptions={{ fillColor, fillOpacity: 0.75, color: fillColor, weight: 0.5 }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
              <div className="pixel-tooltip">
                <div className="pixel-tooltip-row">
                  <span>NDVI</span>
                  <strong>{f.properties.NDVI.toFixed(3)}</strong>
                </div>
                <div className="pixel-tooltip-row">
                  <span>NDMI</span>
                  <strong>{f.properties.NDMI.toFixed(3)}</strong>
                </div>
              </div>
            </Tooltip>
          </Rectangle>
        )
      })
    },
    [pixelGrid, metric]
  )

  return (
    <div>
      <div className="map-header">
        <div>
          <h2 className="panel-title">Field Vegetation Quality Map</h2>
          <p className="panel-subtitle">
            {pixelGrid.metadata.pixel_count} Sentinel-2 pixels (10m x 10m) ·
            Image date: {pixelGrid.metadata.image_date} ·
            NDVI {pixelGrid.metadata.ndvi_min.toFixed(2)}-{pixelGrid.metadata.ndvi_max.toFixed(2)}
            {pixelGrid.metadata.source.includes('SYNTHETIC') ? (
              <span className="mock-badge"> Placeholder data</span>
            ) : (
              <span className="real-badge"> Real GEE export</span>
            )}
            <br />
            <strong>Absolute farm-wide scale</strong> (blocks are comparable).
            Block mean NDVI <strong>{spatialStats.blockMean.toFixed(3)}</strong> —
            young blocks read lower by nature, which is expected, not stress.
          </p>
        </div>
        <div className="metric-selector">
          {['NDVI', 'NDMI'].map((m) => (
            <button
              key={m}
              className={`metric-btn ${metric === m ? 'active' : ''}`}
              onClick={() => setMetric(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="spatial-stats">
        <div className="spatial-stat-bar">
          <div className="bar-segment seg-healthy" style={{ width: `${spatialStats.healthyPct}%` }} title={`${spatialStats.healthy} pixels healthy`}>
            {spatialStats.healthyPct >= 8 && `${spatialStats.healthyPct}%`}
          </div>
          <div className="bar-segment seg-moderate" style={{ width: `${spatialStats.moderatePct}%` }} title={`${spatialStats.moderate} pixels moderate`}>
            {spatialStats.moderatePct >= 8 && `${spatialStats.moderatePct}%`}
          </div>
          <div className="bar-segment seg-stressed" style={{ width: `${spatialStats.stressedPct}%` }} title={`${spatialStats.stressed} pixels need attention`}>
            {spatialStats.stressedPct >= 8 && `${spatialStats.stressedPct}%`}
          </div>
        </div>
        <div className="spatial-stat-legend">
          <span><span className="dot dot-healthy"></span>Healthy NDVI &ge; {NDVI_HEALTHY} ({spatialStats.healthy} px)</span>
          <span><span className="dot dot-moderate"></span>Establishing {NDVI_ATTENTION}–{NDVI_HEALTHY} ({spatialStats.moderate} px)</span>
          <span><span className="dot dot-stressed"></span>Needs attention &lt; {NDVI_ATTENTION} ({spatialStats.stressed} px - {spatialStats.stressArea} m2)</span>
        </div>
        {spatialStats.stressed > 0 && (
          <div className="spatial-action">
            <strong>{spatialStats.stressed} pixels below NDVI {NDVI_ATTENTION}</strong> (genuinely low for
            date palms), clustered toward the <strong>{spatialStats.stressDirection}</strong> of
            the block. Walk that area first - look for yellowing fronds,
            water-deficit symptoms, or salt accumulation.
          </div>
        )}
      </div>

      <div className="map-container">
        <MapContainer
          center={centroid}
          zoom={19}
          maxZoom={20}
          scrollWheelZoom={true}
          style={{ height: '480px', width: '100%', borderRadius: 6 }}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Satellite">
              <TileLayer
                attribution="Esri World Imagery"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={20}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Streets">
              <TileLayer
                attribution="© OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png"
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          {/* Other farms as colored outlines */}
          {allFarms
            .filter((f) => f.id !== farm.id)
            .map((f) => (
              <Polygon
                key={f.id}
                positions={f.polygon.map(([lng, lat]) => [lat, lng])}
                pathOptions={{ color: f.color, fillOpacity: 0.08, weight: 2, dashArray: '5, 4' }}
              >
                <Tooltip sticky>{f.name}</Tooltip>
              </Polygon>
            ))}

          {/* Selected farm pixel heatmap */}
          {pixelRects}

          {/* Selected farm boundary */}
          <Polygon
            positions={polygonLatLng}
            pathOptions={{ color: farm.color, fillOpacity: 0, weight: 3 }}
          />
        </MapContainer>
      </div>

      <div className="map-legend">
        <span className="legend-label">{metric}</span>
        <div className="legend-bar">
          {RAMPS[metric].map((stop, i) => (
            <div
              key={i}
              className="legend-stop"
              style={{ background: stop.color }}
              title={stop.label}
            >
              <span className="legend-stop-label">
                {stop.lt === Infinity ? `≥${RAMPS[metric][i - 1].lt}` : stop.lt}
              </span>
            </div>
          ))}
        </div>
        <div className="legend-extremes">
          <span>{RAMPS[metric][0].label}</span>
          <span>{RAMPS[metric][RAMPS[metric].length - 1].label}</span>
        </div>
      </div>
    </div>
  )
}

export default FieldMap

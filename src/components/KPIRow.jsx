import './KPIRow.css'

const formatDelta = (delta) => {
  if (Math.abs(delta) < 0.005) return 'about normal for now'
  const pct = Math.abs(delta * 100).toFixed(0)
  return `${pct}% ${delta > 0 ? 'above' : 'below'} the usual for this month`
}

const trendWord = {
  rising: { icon: '↑', text: 'Greening up', cls: 'good' },
  falling: { icon: '↓', text: 'Declining', cls: 'warn' },
  stable: { icon: '→', text: 'Holding steady', cls: 'neutral' },
}

// Plain-language take on the NDVI↔moisture correlation (the old "r = …").
const irrigationPlain = (assessment) =>
  ({
    effective: 'Water is reaching the trees',
    adequate: 'Water mostly reaching trees',
    weak: 'Water not fully reaching trees',
    concerning: "Water isn't reaching trees",
  }[assessment] || '—')

// Plain-language take on the coefficient of variation (the old "/100, CV").
const uniformityPlain = (rating) =>
  ({
    excellent: 'Very even',
    good: 'Fairly even',
    mixed: 'Patchy',
    poor: 'Very patchy',
  }[rating] || rating)

function KPIRow({ data, insights }) {
  const latest = data[data.length - 1]
  const { currentVsExpected, trend, irrigation, uniformity, stressZone } = insights
  const t = trendWord[trend?.direction] || { icon: '·', text: '—', cls: 'neutral' }

  return (
    <div className="kpi-row">
      <div className="kpi-card">
        <div className="kpi-label">Latest greenness</div>
        <div className="kpi-value">{latest.ndvi_mean.toFixed(3)}</div>
        <div className="kpi-meta">
          {currentVsExpected && (
            <span className={currentVsExpected.delta >= 0 ? 'delta-positive' : 'delta-negative'}>
              {formatDelta(currentVsExpected.delta)}
            </span>
          )}
        </div>
        <div
          className="kpi-sub"
          title="Sentinel-2 revisits every ~5 days. The satellite export currently ends 2026-04-29, so any later reading is a modeled estimate until the next image arrives."
        >
          NDVI · reading of {latest.date}
          {latest.estimated ? ' · modeled, not yet measured' : ''}
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-label">Direction</div>
        <div className={`kpi-value kpi-value-text kpi-${t.cls}`}>
          {t.icon} {t.text}
        </div>
        <div className="kpi-sub">over the last {trend?.observations} readings</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-label">Irrigation</div>
        <div className="kpi-value kpi-value-text">{irrigationPlain(irrigation.assessment)}</div>
        <div className="kpi-sub">greenness vs. moisture · r = {irrigation.correlation.toFixed(2)}</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-label">Field evenness</div>
        <div className="kpi-value kpi-value-text">{uniformityPlain(uniformity.rating)}</div>
        <div className="kpi-sub">{uniformity.score}/100 · CV {uniformity.cv.toFixed(2)}</div>
      </div>

      <div className={`kpi-card ${stressZone.detected ? 'kpi-alert' : ''}`}>
        <div className="kpi-label">Problem patch</div>
        <div className="kpi-value kpi-value-text">
          {stressZone.detected ? 'Yes — check field' : 'None spotted'}
        </div>
        <div className="kpi-sub">
          {stressZone.detected
            ? `seen in ${(stressZone.persistenceRatio * 100).toFixed(0)}% of recent readings`
            : 'field is consistent'}
        </div>
      </div>
    </div>
  )
}

export default KPIRow

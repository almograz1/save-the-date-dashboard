import './KPIRow.css'

const formatDelta = (delta) => {
  if (Math.abs(delta) < 0.005) return 'near expected'
  const pct = (delta * 100).toFixed(1)
  return `${delta > 0 ? '+' : ''}${pct}%`
}

const trendIcon = (direction) => {
  if (direction === 'rising') return '↑'
  if (direction === 'falling') return '↓'
  return '→'
}

function KPI({ label, value, meta, sub, icon, tone = 'neutral', alert = false, className = '' }) {
  return (
    <article className={`kpi-card kpi-${tone} ${alert ? 'kpi-alert' : ''} ${className}`}>
      <div className="kpi-card-head">
        <span className="kpi-label">{label}</span>
        <span className="kpi-icon" aria-hidden="true">{icon}</span>
      </div>
      <div className="kpi-value">{value}</div>
      {meta && <div className="kpi-meta">{meta}</div>}
      {sub && <div className="kpi-sub">{sub}</div>}
    </article>
  )
}

function KPIRow({ data, insights }) {
  const latest = data[data.length - 1]
  const { currentVsExpected, trend, irrigation, stressZone } = insights

  return (
    <div className="kpi-row">
      <KPI
        label="Vegetation Health (NDVI)"
        icon="🌿"
        tone={currentVsExpected?.delta >= 0 ? 'positive' : 'warning'}
        value={latest.ndvi_mean.toFixed(3)}
        meta={currentVsExpected && (
          <span className={currentVsExpected.delta >= 0 ? 'delta-positive' : 'delta-negative'}>
            {formatDelta(currentVsExpected.delta)} vs expected
          </span>
        )}
        sub={latest.date}
      />

      <KPI
        label="Recent Trend"
        icon="📈"
        tone={trend?.direction === 'falling' ? 'warning' : 'neutral'}
        value={(
          <>
            {trendIcon(trend?.direction)} <span className="kpi-value-text">{trend?.direction || '-'}</span>
          </>
        )}
        sub={`last ${trend?.observations ?? '-'} observations`}
        className="kpi-mobile-hide"
      />

      <KPI
        label="Irrigation Effectiveness"
        icon="💧"
        tone={irrigation.assessment === 'effective' ? 'positive' : 'warning'}
        value={<span className="kpi-value-text">{irrigation.assessment}</span>}
        meta={`r = ${irrigation.correlation.toFixed(2)} (vegetation health ↔ soil moisture)`}
        className="kpi-mobile-hide"
      />

      <KPI
        label="Stress Zone"
        icon="⚠"
        tone={stressZone.detected ? 'warning' : 'positive'}
        alert={stressZone.detected}
        value={<span className="kpi-value-text">{stressZone.detected ? 'Detected' : 'Clear'}</span>}
        meta={stressZone.detected ? `${(stressZone.persistenceRatio * 100).toFixed(0)}% of recent obs` : 'field is consistent'}
        className="kpi-mobile-hide"
      />
    </div>
  )
}

export default KPIRow

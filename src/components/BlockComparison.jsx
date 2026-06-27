import './BlockComparison.css'

const trendIcon = { rising: '↑', falling: '↓', stable: '→' }
const trendClass = { rising: 'tr-up', falling: 'tr-down', stable: 'tr-flat' }

/**
 * All four blocks at a glance, ranked so the one needing attention is on top.
 * Clicking a row focuses that block across the rest of the dashboard.
 */
function BlockComparison({ blocks, selectedId, onSelect }) {
  return (
    <div className="block-compare">
      <div className="block-compare-head">
        <h2 className="panel-title">Which block needs you this week?</h2>
        <p className="panel-subtitle">
          All four blocks side by side, most-concerning first. Click one to focus
          the dashboard on it.
        </p>
      </div>

      <div className="block-compare-grid">
        <div className="bc-row bc-header">
          <span>Block</span>
          <span>NDVI now</span>
          <span>Trend</span>
          <span>Low-NDVI area</span>
          <span>Status</span>
        </div>
        {blocks.map((b) => (
          <button
            key={b.id}
            className={`bc-row ${b.id === selectedId ? 'bc-row-active' : ''}`}
            onClick={() => onSelect(b.id)}
          >
            <span className="bc-block">
              <span className="bc-dot" style={{ background: b.color }} />
              <span>
                <strong>{b.name}</strong>
                <span className="bc-sub">{b.subtitle}</span>
              </span>
            </span>
            <span className="bc-ndvi">{b.currentNdvi.toFixed(3)}</span>
            <span className={`bc-trend ${trendClass[b.trend] || ''}`}>
              {trendIcon[b.trend] || '—'} {b.trend || '—'}
            </span>
            <span className="bc-stress">{b.stressedPct}%</span>
            <span className={`bc-status bc-status-${b.level}`}>{b.statusLabel}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default BlockComparison

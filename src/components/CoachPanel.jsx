import { useState } from 'react'
import './CoachPanel.css'

const HORIZON_LABEL = {
  now: 'Act Today',
  week: 'This Week',
  season: 'This Season',
  longterm: 'Long Term',
}

const HORIZON_ORDER = { now: 0, week: 1, season: 2, longterm: 3 }

const CATEGORY_ICON = {
  irrigation: '💧',
  inspection: '🔍',
  harvest: '🌴',
  planting: '🌱',
  system: '⚙',
}

const SECTIONS = [
  { key: 'immediate', label: 'Immediate Actions', horizons: ['now', 'week'] },
  { key: 'strategic', label: 'Strategic Planning', horizons: ['season', 'longterm'] },
]

function RecCard({ rec }) {
  const [expanded, setExpanded] = useState(rec.priority === 'high')

  return (
    <div className={`rec-card rec-${rec.priority}`}>
      <button className="rec-header" onClick={() => setExpanded((v) => !v)}>
        <span className="rec-icon">{CATEGORY_ICON[rec.category]}</span>
        <div className="rec-header-text">
          <span className="rec-title">{rec.title}</span>
          <div className="rec-chips">
            <span className={`rec-chip chip-priority chip-${rec.priority}`}>
              {rec.priority}
            </span>
            <span className="rec-chip chip-horizon">
              {HORIZON_LABEL[rec.horizon]}
            </span>
            <span className="rec-chip chip-category">{rec.category}</span>
          </div>
        </div>
        <span className="rec-toggle">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="rec-body">
          <p className="rec-why">{rec.body}</p>
          <div className="rec-action-box">
            <span className="rec-action-label">✓ What to do</span>
            <p className="rec-action-text">{rec.action}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function CoachPanel({ recommendations }) {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div>
        <h2 className="panel-title">Your To-Do List</h2>
        <p className="panel-subtitle">Nothing to do on this block right now — everything looks healthy.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="coach-header">
        <div>
          <h2 className="panel-title">Your To-Do List</h2>
          <p className="panel-subtitle">
            What to do on this block, most urgent first. Tap any item to see why
            and the exact steps. Urgent ones are open already.
          </p>
        </div>
        <div className="coach-summary">
          {['high', 'medium', 'low'].map((p) => {
            const count = recommendations.filter((r) => r.priority === p).length
            return count > 0 ? (
              <span key={p} className={`summary-chip chip-priority chip-${p}`}>
                {count} {p}
              </span>
            ) : null
          })}
        </div>
      </div>

      {SECTIONS.map((section) => {
        const items = recommendations
          .filter((r) => section.horizons.includes(r.horizon))
          .sort((a, b) => HORIZON_ORDER[a.horizon] - HORIZON_ORDER[b.horizon])

        if (items.length === 0) return null

        return (
          <div key={section.key} className="coach-section">
            <div className="coach-section-label">{section.label}</div>
            <div className="rec-list">
              {items.map((rec) => (
                <RecCard key={rec.id} rec={rec} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default CoachPanel

import { useState, useEffect, useRef } from 'react'
import './AlertBanner.css'

function AlertBanner({ currentNdvi, latestDate }) {
  const [threshold, setThreshold] = useState(0.25)
  const [showSettings, setShowSettings] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const notifiedRef = useRef(false)

  const delta = currentNdvi - threshold
  const isAlert = delta < 0
  const isWarning = delta >= 0 && delta < 0.03

  useEffect(() => {
    if (isAlert && !notifiedRef.current) {
      notifiedRef.current = true
      if ('Notification' in window) {
        const send = () => {
          new Notification('Date Farm Alert', {
            body: `NDVI ${currentNdvi.toFixed(3)} is below threshold ${threshold.toFixed(2)} - check field conditions.`,
            icon: '/favicon.ico',
          })
        }
        if (Notification.permission === 'granted') {
          send()
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then((p) => { if (p === 'granted') send() })
        }
      }
    }
    if (!isAlert) notifiedRef.current = false
  }, [isAlert, currentNdvi, threshold])

  // Reset dismissal when status changes
  useEffect(() => { setDismissed(false) }, [isAlert, isWarning])

  if (!isAlert && !isWarning) return null
  if (dismissed) return null

  return (
    <div className={`alert-banner alert-banner-${isAlert ? 'alert' : 'warning'}`}>
      <div className="alert-banner-left">
        <span className="alert-icon">{isAlert ? '🔴' : '🟡'}</span>
        <div>
          <strong>
            {isAlert ? 'NDVI below threshold' : 'NDVI approaching threshold'}
          </strong>
          <span className="alert-detail">
            &nbsp;- current {currentNdvi.toFixed(3)} vs threshold {threshold.toFixed(2)} · {latestDate}
          </span>
        </div>
      </div>

      <div className="alert-banner-right">
        <button
          className="alert-settings-btn"
          onClick={() => setShowSettings((s) => !s)}
          title="Configure threshold"
        >
          ⚙ Threshold
        </button>
        <button className="alert-dismiss-btn" onClick={() => setDismissed(true)}>✕</button>
      </div>

      {showSettings && (
        <div className="alert-settings-panel">
          <label className="alert-settings-label">
            Alert threshold: <strong>{threshold.toFixed(2)}</strong>
          </label>
          <input
            type="range"
            min="0.15"
            max="0.40"
            step="0.01"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="alert-slider"
          />
          <span className="alert-settings-hint">0.15 (severe stress) → 0.40 (thriving)</span>
        </div>
      )}
    </div>
  )
}

export default AlertBanner

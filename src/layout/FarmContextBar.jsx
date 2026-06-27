import './FarmContextBar.css'

function FarmContextBar({ farm, clean, data, estimatedFrom }) {
  const latest = clean[clean.length - 1]
  const startDate = data[0]?.date ?? '-'
  const endDate = data[data.length - 1]?.date ?? '-'

  return (
    <section className="farm-context-bar" aria-label="Selected farm context">
      <div className="farm-context-primary">
        <span className="farm-context-dot" style={{ background: farm.color }} />
        <div>
          <strong>{farm.name}</strong>
          <span>{farm.subtitle}</span>
        </div>
      </div>

      <div className="farm-context-metrics">
        <span>{clean.length} observations</span>
        <span>{startDate} to {endDate}</span>
        <span>Vegetation Health (NDVI) {latest?.ndvi_mean.toFixed(3) ?? '-'}</span>
      </div>

      {estimatedFrom && (
        <span
          className="farm-context-estimated"
          title="Sentinel-2 export stopped after 2026-04-29; later points are modeled from the seasonal pattern"
        >
          modeled since {estimatedFrom}
        </span>
      )}
    </section>
  )
}

export default FarmContextBar

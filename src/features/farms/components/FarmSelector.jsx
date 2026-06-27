import './FarmSelector.css'

function ndviColor(avg) {
  if (avg >= 0.35) return '#15803d'
  if (avg >= 0.28) return '#b7791f'
  return '#bc2f2f'
}

function FarmSelector({ farms, allPixelGrids, selectedId, onChange }) {
  return (
    <section className="farm-selector" aria-label="Farm block selector">
      <div className="farm-selector-heading">
        <span className="farm-selector-kicker">Blocks</span>
        <strong>Switch farm context</strong>
      </div>

      <div className="farm-selector-tabs">
        {farms.map((farm) => {
          const grid = allPixelGrids[farm.id]
          const ndvis = grid?.features.map((feature) => feature.properties.NDVI) ?? []
          const avg = ndvis.length ? ndvis.reduce((sum, value) => sum + value, 0) / ndvis.length : 0
          const isSelected = farm.id === selectedId

          return (
            <button
              key={farm.id}
              type="button"
              className={`farm-tab ${isSelected ? 'farm-tab-active' : ''}`}
              style={isSelected ? { '--farm-color': farm.color } : { '--farm-color': farm.color }}
              onClick={() => onChange(farm.id)}
              aria-pressed={isSelected}
            >
              <span className="farm-tab-topline">
                <span className="farm-tab-dot" style={{ background: farm.color }} />
                <span className="farm-tab-ndvi" style={{ color: ndviColor(avg) }}>
                  {avg.toFixed(3)} Veg. Health (NDVI)
                </span>
              </span>
              <span className="farm-tab-name">{farm.name}</span>
              <span className="farm-tab-sub">{farm.subtitle}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default FarmSelector

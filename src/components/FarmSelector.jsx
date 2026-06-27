import './FarmSelector.css'

function ndviColor(avg) {
  if (avg >= 0.35) return '#16a34a'
  if (avg >= 0.28) return '#f59e0b'
  return '#dc2626'
}

function FarmSelector({ farms, allPixelGrids, selectedId, onChange }) {
  return (
    <div className="farm-selector">
      {farms.map((farm) => {
        const grid = allPixelGrids[farm.id]
        const ndvis = grid?.features.map((f) => f.properties.NDVI) ?? []
        const avg = ndvis.length ? ndvis.reduce((s, v) => s + v, 0) / ndvis.length : 0
        const isSelected = farm.id === selectedId

        return (
          <button
            key={farm.id}
            className={`farm-tab ${isSelected ? 'farm-tab-active' : ''}`}
            style={isSelected ? { borderBottomColor: farm.color } : {}}
            onClick={() => onChange(farm.id)}
          >
            <span className="farm-tab-dot" style={{ background: farm.color }} />
            <span className="farm-tab-name">{farm.name}</span>
            <span className="farm-tab-sub">{farm.subtitle}</span>
            {grid && (
              <span className="farm-tab-ndvi" style={{ color: ndviColor(avg) }}>
                {avg.toFixed(3)}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default FarmSelector

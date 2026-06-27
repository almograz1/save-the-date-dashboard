import FieldMap from '../components/FieldMap'

/** Spatial vegetation-quality heatmap for the selected block. */
function MapPage({ pixelGrid, farm, allFarms }) {
  return (
    <section className="panel">
      <FieldMap pixelGrid={pixelGrid} farm={farm} allFarms={allFarms} />
    </section>
  )
}

export default MapPage

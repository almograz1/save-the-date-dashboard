import NDVIChart from '../components/NDVIChart'
import StressZonePanel from '../components/StressZonePanel'
import SeasonalChart from '../components/SeasonalChart'
import SoilPanel from '../components/SoilPanel'

/** Time-series analysis: NDVI/NDMI/SAVI history, stress-gap, seasonal, bare soil. */
function TrendsPage({ data, clean, insights, soil, estimatedFrom }) {
  return (
    <>
      <div className="grid-2col">
        <section className="panel">
          <NDVIChart data={data} estimatedFrom={estimatedFrom} />
        </section>
        <section className="panel">
          <StressZonePanel insights={insights} data={clean} />
        </section>
      </div>
      <div className="grid-2col">
        <section className="panel">
          <SeasonalChart seasonal={insights.seasonal} />
        </section>
        <section className="panel">
          <SoilPanel soil={soil} />
        </section>
      </div>
    </>
  )
}

export default TrendsPage

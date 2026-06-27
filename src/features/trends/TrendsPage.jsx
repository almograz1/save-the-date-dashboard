import NDVIChart from './components/NDVIChart'
import StressZonePanel from './components/StressZonePanel'
import SeasonalChart from './components/SeasonalChart'

/** Time-series analysis: NDVI/NDMI history, stress-gap, and seasonal pattern. */
function TrendsPage({ data, clean, insights, estimatedFrom }) {
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
      <section className="panel mobile-hide">
        <SeasonalChart seasonal={insights.seasonal} />
      </section>
    </>
  )
}

export default TrendsPage

import ForecastPanel from '../components/ForecastPanel'

/** Kriging-based predictions: harvest peak and next irrigation window. */
function ForecastPage({ forecast, irrigation, harvest }) {
  return (
    <section className="panel">
      <ForecastPanel
        irrigation={irrigation}
        harvest={harvest}
        series={forecast.series}
        observed={forecast.observed}
        forecastStart={forecast.forecastStart}
        peakPoint={forecast.peakPoint}
      />
    </section>
  )
}

export default ForecastPage

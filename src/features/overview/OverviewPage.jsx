import AlertBanner from './components/AlertBanner'
import KPIRow from './components/KPIRow'

/** At-a-glance health: threshold alert + the five headline KPIs. */
function OverviewPage({ clean, insights, latestClean }) {
  return (
    <>
      <AlertBanner currentNdvi={latestClean.ndvi_mean} latestDate={latestClean.date} />
      <KPIRow data={clean} insights={insights} />
    </>
  )
}

export default OverviewPage

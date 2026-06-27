import AlertBanner from '../components/AlertBanner'
import KPIRow from '../components/KPIRow'
import BlockComparison from '../components/BlockComparison'
import FarmStatus from '../components/FarmStatus'

/** At-a-glance health: farm verdict, cross-block triage, alert, headline KPIs. */
function OverviewPage({ clean, insights, latestClean, blocks, selectedId, onSelect }) {
  return (
    <>
      <FarmStatus blocks={blocks} onSelect={onSelect} />
      <section className="panel">
        <BlockComparison blocks={blocks} selectedId={selectedId} onSelect={onSelect} />
      </section>
      <AlertBanner currentNdvi={latestClean.ndvi_mean} latestDate={latestClean.date} />
      <KPIRow data={clean} insights={insights} />
    </>
  )
}

export default OverviewPage

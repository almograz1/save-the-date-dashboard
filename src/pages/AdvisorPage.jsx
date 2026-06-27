import CoachPanel from '../components/CoachPanel'
import InsightsPanel from '../components/InsightsPanel'

/** Actionable coaching plus the narrative key findings. */
function AdvisorPage({ recommendations, insights, clean }) {
  return (
    <>
      <section className="panel">
        <CoachPanel recommendations={recommendations} />
      </section>
      <section className="panel">
        <InsightsPanel insights={insights} clean={clean} />
      </section>
    </>
  )
}

export default AdvisorPage

import './FarmStatus.css'

/**
 * The one-glance verdict for the whole farm — the first thing Ziv should see.
 * Rolls the four blocks' concern levels up into a single plain-language status
 * and, when something needs a look, a button that jumps straight to that
 * block's to-do list.
 */
function FarmStatus({ blocks, onSelect }) {
  const attention = blocks.filter((b) => b.level === 'attention')
  const watch = blocks.filter((b) => b.level === 'ok')

  let tone, icon, headline, sub, target
  if (attention.length) {
    tone = 'act'
    icon = '⚠️'
    headline =
      attention.length === 1
        ? `${attention[0].name} needs a look`
        : `${attention.length} blocks need a look`
    sub = 'Open it to see exactly what to do today.'
    target = attention[0]
  } else if (watch.length) {
    tone = 'watch'
    icon = '👀'
    headline =
      watch.length === 1
        ? `Keep an eye on ${watch[0].name}`
        : `Keep an eye on ${watch.length} blocks`
    sub = "Nothing urgent — worth a check when you're nearby."
    target = watch[0]
  } else {
    tone = 'good'
    icon = '✅'
    headline = 'Your farm looks healthy'
    sub = 'All four blocks are within their normal range today.'
    target = null
  }

  const goToBlock = (id) => {
    onSelect(id)
    window.location.hash = '#/advisor'
  }

  return (
    <div className={`farm-status farm-status-${tone}`}>
      <span className="farm-status-icon" aria-hidden="true">{icon}</span>
      <div className="farm-status-text">
        <div className="farm-status-headline">{headline}</div>
        <div className="farm-status-sub">{sub}</div>
      </div>
      {target && (
        <button className="farm-status-cta" onClick={() => goToBlock(target.id)}>
          Show me {target.name} →
        </button>
      )}
    </div>
  )
}

export default FarmStatus

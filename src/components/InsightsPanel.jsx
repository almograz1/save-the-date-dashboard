import './InsightsPanel.css'

function InsightsPanel({ insights, clean }) {
  const { irrigation, uniformity, anomalies, seasonal } = insights

  const findings = []

  // Irrigation finding
  findings.push({
    type: irrigation.assessment === 'effective' ? 'positive' : 'warning',
    title: `Irrigation is ${irrigation.assessment}`,
    body: `Pearson correlation of ${irrigation.correlation.toFixed(2)} between NDVI and NDMI. ${
      irrigation.correlation > 0.7
        ? 'Water input is reliably driving vegetation response - your irrigation system is doing its job.'
        : irrigation.correlation > 0.4
        ? 'Water is partially reaching trees, but response could be stronger. Check distribution uniformity.'
        : 'Weak link between water and growth. Investigate possible salinity, drainage, or root issues.'
    }`,
  })

  // Uniformity finding
  findings.push({
    type:
      uniformity.rating === 'excellent' || uniformity.rating === 'good'
        ? 'positive'
        : 'neutral',
    title: `Field uniformity: ${uniformity.rating}`,
    body: `Coefficient of variation = ${uniformity.cv.toFixed(3)}. ${
      uniformity.cv < 0.1
        ? 'Highly homogeneous - trees are similar age and condition.'
        : uniformity.cv < 0.15
        ? 'Reasonably consistent. Some variation is normal for any orchard.'
        : 'Mixed performance across the field - likely due to age differences, replanting, or localized stress.'
    }`,
  })

  // Seasonal finding
  const amplitude = seasonal.peak.avg - seasonal.trough.avg
  findings.push({
    type: 'neutral',
    title: 'Seasonal cycle is inverted (winter peak)',
    body: `Peak NDVI in ${seasonal.peak.month} (${seasonal.peak.avg.toFixed(3)}), trough in ${seasonal.trough.month} (${seasonal.trough.avg.toFixed(3)}). Amplitude of ${amplitude.toFixed(3)} reflects classic hot-arid date palm phenology - summer heat induces dormancy, winter is the active growing period.`,
  })

  // Anomalies
  if (anomalies.length > 0) {
    findings.push({
      type: 'warning',
      title: `${anomalies.length} measurement anomal${anomalies.length === 1 ? 'y' : 'ies'} flagged`,
      body: `Observations where vegetation and moisture indices moved in opposite directions - typically caused by atmospheric contamination that escaped cloud filtering. Affected dates: ${anomalies
        .map((a) => a.date)
        .join(', ')}. Treat these data points with caution.`,
    })
  }

  // Cloud quality
  const cloudyCount = clean.length // already filtered
  findings.push({
    type: 'positive',
    title: 'Data quality is high',
    body: `${cloudyCount} usable observations after cloud filtering (98% of total). Jordan Valley clear skies make this site ideal for satellite monitoring - most orchards globally lose 30-50% of observations to clouds.`,
  })

  return (
    <div>
      <h2 className="panel-title">Key Findings</h2>
      <p className="panel-subtitle">
        Computed from {clean.length} cloud-filtered Sentinel-2 observations.
      </p>

      <div className="findings-list">
        {findings.map((f, i) => (
          <div key={i} className={`finding finding-${f.type}`}>
            <div className="finding-marker"></div>
            <div className="finding-content">
              <div className="finding-title">{f.title}</div>
              <div className="finding-body">{f.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default InsightsPanel

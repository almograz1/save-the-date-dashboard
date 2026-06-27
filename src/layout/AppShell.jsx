import NavBar from './NavBar'
import FarmContextBar from './FarmContextBar'
import './AppShell.css'

const formatDelta = (delta) => {
  if (delta == null) return '-'
  if (Math.abs(delta) < 0.005) return 'near expected'
  return `${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)}% vs expected`
}

const titleCase = (text) => {
  if (!text) return '-'
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function MetricPill({ label, value, tone = 'neutral' }) {
  return (
    <div className={`hero-metric hero-metric-${tone}`}>
      <span className="hero-metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function AppShell({
  pages,
  active,
  farm,
  clean,
  data,
  insights,
  estimatedFrom,
  farmSelector,
  weatherData,
  children,
}) {
  const activePage = pages.find((page) => page.id === active) ?? pages[0]
  const latest = clean[clean.length - 1]
  const stressDetected = insights.stressZone?.detected
  const trendDirection = insights.trend?.direction
  const delta = insights.currentVsExpected?.delta

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <a className="brand" href="#/overview" aria-label="Date Farm Dashboard home">
          <span className="brand-mark">🌴</span>
          <span>
            <strong>Date Farm</strong>
            <small>Naama remote sensing</small>
          </span>
        </a>

        <NavBar pages={pages} active={active} />

        <div className="sidebar-card">
          <span className="sidebar-card-label">Selected block</span>
          <strong>{farm.name}</strong>
          <span>{farm.subtitle}</span>
          <div className="sidebar-card-dot" style={{ background: farm.color }} />
        </div>
      </aside>

      <div className="app-content">
        <header className="app-hero">
          <div className="hero-copy">
            <span className="eyebrow">{activePage.eyebrow}</span>
            <h1>{activePage.title}</h1>
            <p>{activePage.description}</p>
          </div>
          <div className="hero-status-card">
            <span className="status-label">Vegetation Health (NDVI)</span>
            <strong>{latest?.ndvi_mean.toFixed(3) ?? '-'}</strong>
            <span className={delta >= 0 ? 'status-positive' : 'status-negative'}>
              {formatDelta(delta)}
            </span>
          </div>
        </header>

        <NavBar pages={pages} active={active} variant="mobile" />

        <section className="hero-metric-grid" aria-label="Current farm summary">
          <MetricPill
            label="Trend"
            value={titleCase(trendDirection)}
            tone={trendDirection === 'falling' ? 'warning' : 'positive'}
          />
          <MetricPill
            label="Irrigation"
            value={titleCase(insights.irrigation?.assessment)}
            tone={insights.irrigation?.assessment === 'effective' ? 'positive' : 'warning'}
          />
          <MetricPill
            label="Evaporation"
            value={weatherData ? `${weatherData.forecastET.toFixed(1)} mm/day` : '…'}
            tone={
              !weatherData ? 'neutral'
              : weatherData.etAnomalyRatio > 1.25 ? 'warning'
              : 'positive'
            }
          />
          <MetricPill
            label="Stress zone"
            value={stressDetected ? titleCase(insights.stressZone.severity) : 'Clear'}
            tone={stressDetected ? 'warning' : 'positive'}
          />
        </section>

        {farmSelector}

        <FarmContextBar
          farm={farm}
          clean={clean}
          data={data}
          estimatedFrom={estimatedFrom}
        />

        <main className="dashboard-main">
          {children}
        </main>
      </div>
    </div>
  )
}

export default AppShell

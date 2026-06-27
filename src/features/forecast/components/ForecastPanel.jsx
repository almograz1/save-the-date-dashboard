import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceDot,
} from 'recharts'
import './ForecastPanel.css'

const statusColor = {
  critical: '#dc2626',
  warning: '#f59e0b',
  ok: '#16a34a',
  adequate: '#16a34a',
}

const statusLabel = {
  critical: 'Irrigate now',
  warning: 'Irrigate soon',
  ok: 'On track',
  adequate: 'Adequate',
}

const formatDateTick = (t) =>
  new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const ForecastTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null
  const p = payload[0].payload
  return (
    <div className="forecast-tooltip">
      <div className="forecast-tooltip-date">
        {new Date(p.t).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </div>
      {p.ndvi != null && (
        <div className="forecast-tooltip-row">
          <span>Observed</span>
          <span className="val">{p.ndvi.toFixed(3)}</span>
        </div>
      )}
      {p.mean != null && (
        <>
          <div className="forecast-tooltip-row">
            <span>Predicted</span>
            <span className="val">{p.mean.toFixed(3)}</span>
          </div>
          <div className="forecast-tooltip-row meta">
            <span>95% band</span>
            <span className="val">
              {p.band[0].toFixed(3)} – {p.band[1].toFixed(3)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function ForecastPanel({ irrigation, harvest, series, observed, forecastStart, peakPoint }) {
  const irrigColor = statusColor[irrigation?.status] ?? '#6b7280'
  const irrigLabel = statusLabel[irrigation?.status] ?? '-'

  const harvestMonthDisplay = harvest?.nextPeakDate
    ? new Date(harvest.nextPeakDate + '-01').toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : '-'

  const hasChart = series && series.length > 0

  return (
    <div>
      <h2 className="panel-title">Forecasts</h2>
      <p className="panel-subtitle">
        Statistical predictions from <strong>kriging</strong> (geostatistics):
        the Vegetation Health (NDVI) peak marks the best harvest window;
        irrigation timing is projected from the recent Soil Moisture (NDMI)
        trend. Shaded bands are 95% confidence intervals.
      </p>

      {hasChart && (
        <div className="forecast-chart">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={formatDateTick}
                stroke="#9ca3af"
                fontSize={11}
                minTickGap={50}
                allowDuplicatedCategory={false}
              />
              <YAxis
                domain={[0, 0.6]}
                ticks={[0, 0.15, 0.3, 0.45, 0.6]}
                stroke="#16a34a"
                fontSize={11}
                label={{
                  value: 'NDVI',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 14,
                  style: { fontSize: 11, fill: '#16a34a' },
                }}
              />
              <Tooltip content={<ForecastTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />

              <Area
                data={series}
                dataKey="band"
                fill="#86efac"
                stroke="none"
                fillOpacity={0.35}
                name="95% confidence"
                isAnimationActive={false}
              />
              <Line
                data={series}
                dataKey="mean"
                stroke="#16a34a"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                name="Predicted vegetation health (NDVI)"
                isAnimationActive={false}
              />
              <Scatter
                data={observed}
                dataKey="ndvi"
                fill="#15803d"
                name="Observed vegetation health (NDVI)"
                isAnimationActive={false}
              />

              {forecastStart != null && (
                <ReferenceLine
                  x={forecastStart}
                  stroke="#9ca3af"
                  strokeDasharray="4 4"
                  label={{ value: 'forecast →', position: 'insideTopRight', fontSize: 10, fill: '#6b7280' }}
                />
              )}
              {peakPoint && (
                <ReferenceDot
                  x={peakPoint.t}
                  y={peakPoint.ndvi}
                  r={5}
                  fill="#ca8a04"
                  stroke="#fff"
                  label={{ value: 'predicted peak', position: 'top', fontSize: 10, fill: '#a16207' }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="forecast-grid">
        {/* Irrigation forecast */}
        <div className="forecast-card">
          <div className="forecast-card-header">
            <span className="forecast-icon">💧</span>
            <span className="forecast-card-title">Next Irrigation Window</span>
          </div>
          {irrigation ? (
            <>
              <div className="forecast-value" style={{ color: irrigColor }}>
                {irrigation.status === 'adequate'
                  ? 'No alert'
                  : irrigation.daysUntilStress === 0
                  ? 'Now'
                  : `~${irrigation.daysUntilStress} days`}
              </div>
              <div className="forecast-meta">
                <span
                  className="forecast-badge"
                  style={{ background: irrigColor + '22', color: irrigColor }}
                >
                  {irrigLabel}
                </span>
              </div>
              <div className="forecast-detail">
                Current Soil Moisture (NDMI): {irrigation.currentNdmi.toFixed(3)} ·{' '}
                {irrigation.status === 'adequate'
                  ? 'Kriged trend stays above the stress threshold'
                  : irrigation.stressDate
                  ? `Stress threshold projected: ${irrigation.stressDate}`
                  : 'Already at stress level'}
              </div>
              <div className="forecast-note">
                Universal Kriging (linear drift) on last 16 obs · trend{' '}
                {irrigation.ndmiSlope > 0 ? '+' : ''}
                {irrigation.ndmiSlope.toFixed(4)} soil moisture change / observation
              </div>
              {irrigation.forecastET != null && (
                <div
                  className="forecast-note"
                  style={{ marginTop: 6, color: irrigation.etMultiplier > 1.1 ? '#b45309' : '#6b7280' }}
                >
                  Evaporation forecast: {irrigation.forecastET.toFixed(1)} mm/day
                  {' '}({irrigation.etMultiplier > 1 ? '+' : ''}{Math.round((irrigation.etMultiplier - 1) * 100)}%
                  vs seasonal average of {irrigation.etBaseline?.toFixed(1)} mm/day)
                  {irrigation.etMultiplier > 1.1 ? ' — hot weather is speeding up soil moisture loss' : ''}
                </div>
              )}
            </>
          ) : (
            <div className="forecast-detail">Insufficient data</div>
          )}
        </div>

        {/* Harvest peak forecast */}
        <div className="forecast-card">
          <div className="forecast-card-header">
            <span className="forecast-icon">🌴</span>
            <span className="forecast-card-title">Next Vegetation Health Peak (NDVI) — Harvest Window</span>
          </div>
          {harvest ? (
            <>
              <div className="forecast-value" style={{ color: '#16a34a' }}>
                {harvestMonthDisplay}
              </div>
              <div className="forecast-meta">
                <span
                  className="forecast-badge"
                  style={{ background: '#dcfce7', color: '#166534' }}
                >
                  {harvest.daysUntil} days away
                </span>
              </div>
              <div className="forecast-detail">
                Predicted peak Vegetation Health (NDVI): {harvest.peakNdvi.toFixed(3)} (95% CI{' '}
                {harvest.peakNdviLower.toFixed(3)}–{harvest.peakNdviUpper.toFixed(3)}) ·
                aligns with the winter growth cycle of date palms
              </div>
              <div className="forecast-note">
                Ordinary Kriging of NDVI over the day-of-year cycle — peak is the
                maximum of the fitted seasonal curve
              </div>
            </>
          ) : (
            <div className="forecast-detail">Insufficient data</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ForecastPanel

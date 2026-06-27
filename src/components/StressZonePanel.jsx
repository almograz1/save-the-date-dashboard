import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import './StressZonePanel.css'

const formatDateTick = (s) => {
  const d = new Date(s)
  return d.toLocaleDateString('en-US', { month: 'short' })
}

function StressZonePanel({ insights, data }) {
  const { stressZone } = insights

  // Build the gap series: mean - min for each observation
  const gapSeries = data.slice(-30).map((d) => ({
    date: d.date,
    gap: +(d.ndvi_mean - d.ndvi_min).toFixed(3),
  }))

  return (
    <div>
      <h2 className="panel-title">Stress Zone Analysis</h2>
      <p className="panel-subtitle">
        Gap between field average and worst-performing area. A persistent
        gap means a specific zone in your field is underperforming.
      </p>

      <div
        className={`stress-status stress-${stressZone.severity} ${
          stressZone.detected ? 'active' : 'inactive'
        }`}
      >
        <div className="stress-status-header">
          <span className="stress-icon">
            {stressZone.detected ? '⚠' : '✓'}
          </span>
          <span className="stress-status-text">
            {stressZone.detected
              ? `Persistent stress zone - ${stressZone.severity} severity`
              : 'No persistent stress detected'}
          </span>
        </div>
        {stressZone.detected && (
          <div className="stress-details">
            <div className="stress-detail-row">
              <span>Average NDVI gap</span>
              <span className="stress-value">
                {stressZone.avgGap.toFixed(3)}
              </span>
            </div>
            <div className="stress-detail-row">
              <span>Persistence</span>
              <span className="stress-value">
                {(stressZone.persistenceRatio * 100).toFixed(0)}% of last{' '}
                {stressZone.observationsChecked} observations
              </span>
            </div>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={170}>
        <AreaChart
          data={gapSeries}
          margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateTick}
            stroke="#9ca3af"
            fontSize={10}
            minTickGap={30}
          />
          <YAxis
            domain={[0, 0.3]}
            ticks={[0, 0.1, 0.15, 0.2, 0.3]}
            stroke="#9ca3af"
            fontSize={10}
          />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(v) => v.toFixed(3)}
          />
          <ReferenceLine
            y={0.15}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{
              value: 'concern threshold',
              position: 'right',
              fontSize: 9,
              fill: '#f59e0b',
            }}
          />
          <Area
            type="monotone"
            dataKey="gap"
            stroke="#dc2626"
            fill="#fecaca"
            fillOpacity={0.5}
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>

      {stressZone.detected && (
        <div className="stress-action">
          <strong>Recommended action:</strong> Inspect the lowest-NDVI area
          of your field. Likely 1–2 pixels (~100–200 m²) showing yellowing
          fronds, water deficit, or nutrient deficiency.
        </div>
      )}
    </div>
  )
}

export default StressZonePanel

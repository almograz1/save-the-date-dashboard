import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts'
import './SeasonalChart.css'

const monthLabel = (m) => {
  const [year, mon] = m.split('-')
  const date = new Date(`${year}-${mon}-01`)
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function SeasonalChart({ seasonal }) {
  const { monthlyAvg, peak, trough } = seasonal

  const data = monthlyAvg.map((m) => ({
    month: monthLabel(m.month),
    rawMonth: m.month,
    ndvi: +m.avg.toFixed(3),
    isPeak: m.month === peak.month,
    isTrough: m.month === trough.month,
  }))

  return (
    <div>
      <h2 className="panel-title">Seasonal Pattern</h2>
      <p className="panel-subtitle">
        Monthly average NDVI. For Jordan Valley date palms, peak growth is in
        winter - the inverse of temperate-zone crops. Summer dip reflects
        heat-induced dormancy, not stress.
      </p>

      <div className="seasonal-summary">
        <div className="seasonal-stat">
          <span className="seasonal-label">Peak month</span>
          <span className="seasonal-value">
            {monthLabel(peak.month)} ·{' '}
            <span className="seasonal-num">{peak.avg.toFixed(3)}</span>
          </span>
        </div>
        <div className="seasonal-stat">
          <span className="seasonal-label">Trough month</span>
          <span className="seasonal-value">
            {monthLabel(trough.month)} ·{' '}
            <span className="seasonal-num">{trough.avg.toFixed(3)}</span>
          </span>
        </div>
        <div className="seasonal-stat">
          <span className="seasonal-label">Annual amplitude</span>
          <span className="seasonal-value seasonal-num">
            {(peak.avg - trough.avg).toFixed(3)}
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="month" stroke="#9ca3af" fontSize={11} />
          <YAxis
            domain={[0, 0.5]}
            ticks={[0, 0.1, 0.2, 0.3, 0.4, 0.5]}
            stroke="#9ca3af"
            fontSize={11}
            label={{
              value: 'avg NDVI',
              angle: -90,
              position: 'insideLeft',
              offset: 14,
              style: { fontSize: 11, fill: '#6b7280' },
            }}
          />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(v) => v.toFixed(3)}
          />
          <Bar dataKey="ndvi" radius={[3, 3, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell
                key={idx}
                fill={
                  entry.isPeak
                    ? '#16a34a'
                    : entry.isTrough
                    ? '#f59e0b'
                    : '#86efac'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default SeasonalChart

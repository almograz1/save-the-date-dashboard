import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import './SoilPanel.css'

const formatDateTick = (d) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const directionWord = {
  rising: 'increasing',
  falling: 'decreasing',
  stable: 'steady',
}

function SoilPanel({ soil }) {
  if (!soil) {
    return (
      <div>
        <h2 className="panel-title">Bare Soil &amp; Salinity Watch</h2>
        <p className="panel-subtitle">No bare-soil (BSI) data for this block.</p>
      </div>
    )
  }

  const watch = soil.risk === 'watch'
  const chartData = soil.series.map((d) => ({ date: d.date, bsi: d.bsi }))

  return (
    <div>
      <h2 className="panel-title">Bare Soil &amp; Salinity Watch</h2>
      <p className="panel-subtitle">
        BSI tracks exposed ground between the palms. A steady rise — especially a
        whitish crust forming — is an early sign of <strong>salt buildup</strong>,
        weed loss, or canopy thinning that the greenness number alone won't show.
      </p>

      <div className={`soil-status ${watch ? 'soil-status-watch' : 'soil-status-ok'}`}>
        <span className="soil-status-icon">{watch ? '🧂' : '✓'}</span>
        <div>
          <div className="soil-status-headline">
            {watch
              ? 'Worth a look — bare ground is elevated'
              : 'Ground cover looks normal'}
          </div>
          <div className="soil-status-detail">
            Bare-soil index is <strong>{directionWord[soil.direction]}</strong> over
            the last {soil.observations} readings (now {soil.current.toFixed(3)}).
            {watch
              ? ' Walk the field and check the soil surface for salt crust; flush with extra irrigation if you find any.'
              : ' No salt-crust action needed right now.'}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateTick}
            stroke="#9ca3af"
            fontSize={11}
            minTickGap={50}
          />
          <YAxis stroke="#a16207" fontSize={11} width={44} />
          <Tooltip
            formatter={(v) => [v.toFixed(3), 'BSI']}
            labelFormatter={(l) => l}
          />
          <ReferenceLine y={0} stroke="#d1d5db" />
          <Area
            type="monotone"
            dataKey="bsi"
            stroke="#a16207"
            strokeWidth={2}
            fill="#fde68a"
            fillOpacity={0.5}
            dot={false}
            name="Bare Soil Index"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default SoilPanel

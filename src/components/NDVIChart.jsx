import { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import './NDVIChart.css'

const formatDateTick = (dateStr) => {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null
  const p = payload[0].payload
  return (
    <div className="ndvi-tooltip">
      <div className="ndvi-tooltip-date">{p.date}</div>
      <div className="ndvi-tooltip-row">
        <span className="dot dot-ndvi"></span>
        <span>NDVI</span>
        <span className="val">{p.mean.toFixed(3)}</span>
      </div>
      <div className="ndvi-tooltip-row">
        <span className="dot dot-ndmi"></span>
        <span>NDMI</span>
        <span className="val">{p.ndmi.toFixed(3)}</span>
      </div>
      {p.savi != null && (
        <div className="ndvi-tooltip-row">
          <span className="dot dot-savi"></span>
          <span>SAVI</span>
          <span className="val">{p.savi.toFixed(3)}</span>
        </div>
      )}
      <div className="ndvi-tooltip-row meta">
        <span>NDVI range</span>
        <span className="val">
          {p.range[0].toFixed(2)} – {p.range[1].toFixed(2)}
        </span>
      </div>
      <div className="ndvi-tooltip-row meta">
        <span>Cloud</span>
        <span className="val">{p.cloud.toFixed(1)}%</span>
      </div>
    </div>
  )
}

function exportCSV(data) {
  const headers = ['date', 'ndvi_mean', 'ndvi_min', 'ndvi_max', 'ndvi_std', 'ndmi_mean', 'cloud_cover']
  const rows = data.map((d) =>
    [d.date, d.ndvi_mean, d.ndvi_min, d.ndvi_max, d.ndvi_std, d.ndmi_mean, d.cloud_cover].join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'naama-ndvi-timeseries.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function NDVIChart({ data, estimatedFrom }) {
  const firstDate = data[0]?.date ?? ''
  const lastDate = data[data.length - 1]?.date ?? ''

  const [fromDate, setFromDate] = useState(firstDate)
  const [toDate, setToDate] = useState(lastDate)

  const filteredData = useMemo(
    () => data.filter((d) => d.date >= fromDate && d.date <= toDate),
    [data, fromDate, toDate]
  )

  const chartData = filteredData.map((d) => ({
    date: d.date,
    mean: d.ndvi_mean,
    range: [d.ndvi_min, d.ndvi_max],
    ndmi: d.ndmi_mean,
    savi: d.savi_mean,
    cloud: d.cloud_cover,
  }))

  return (
    <div>
      <div className="ndvi-chart-header">
        <div>
          <h2 className="panel-title">NDVI &amp; Soil Moisture Over Time</h2>
          <p className="panel-subtitle">
            Vegetation health (green) tracking soil moisture (blue). When the
            two move together, irrigation is driving growth. SAVI (teal, dashed)
            is the soil-adjusted greenness — the truer reading for sparsely
            spaced palms.
          </p>
        </div>
        <button
          className="export-btn"
          onClick={() => exportCSV(filteredData)}
          title="Download visible data as CSV"
        >
          ↓ Export CSV
        </button>
      </div>

      <div className="date-filter-row">
        <label className="date-filter-label">
          From
          <input
            type="date"
            className="date-input"
            value={fromDate}
            min={firstDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>
        <label className="date-filter-label">
          To
          <input
            type="date"
            className="date-input"
            value={toDate}
            min={fromDate}
            max={lastDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>
        <button
          className="date-reset-btn"
          onClick={() => { setFromDate(firstDate); setToDate(lastDate) }}
        >
          Reset
        </button>
        <span className="date-filter-count">
          {filteredData.length} of {data.length} observations
        </span>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateTick}
            stroke="#9ca3af"
            fontSize={11}
            minTickGap={50}
          />
          <YAxis
            yAxisId="ndvi"
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
          <YAxis
            yAxisId="ndmi"
            orientation="right"
            domain={[-0.1, 0.4]}
            ticks={[-0.1, 0, 0.1, 0.2, 0.3, 0.4]}
            stroke="#2563eb"
            fontSize={11}
            label={{
              value: 'NDMI',
              angle: 90,
              position: 'insideRight',
              offset: 14,
              style: { fontSize: 11, fill: '#2563eb' },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            iconType="circle"
          />

          {estimatedFrom && estimatedFrom >= fromDate && estimatedFrom <= toDate && (
            <ReferenceLine
              yAxisId="ndvi"
              x={estimatedFrom}
              stroke="#9ca3af"
              strokeDasharray="4 4"
              label={{
                value: 'modeled →',
                position: 'insideTopRight',
                fontSize: 10,
                fill: '#6b7280',
              }}
            />
          )}

          <Area
            yAxisId="ndvi"
            type="monotone"
            dataKey="range"
            fill="#86efac"
            stroke="none"
            fillOpacity={0.3}
            name="NDVI min–max"
          />
          <Line
            yAxisId="ndvi"
            type="monotone"
            dataKey="mean"
            stroke="#16a34a"
            strokeWidth={2}
            dot={{ r: 2.5, fill: '#16a34a' }}
            activeDot={{ r: 5 }}
            name="NDVI mean"
          />
          <Line
            yAxisId="ndvi"
            type="monotone"
            dataKey="savi"
            stroke="#0d9488"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            name="SAVI (soil-adjusted)"
          />
          <Line
            yAxisId="ndmi"
            type="monotone"
            dataKey="ndmi"
            stroke="#2563eb"
            strokeWidth={2}
            strokeDasharray="0"
            dot={{ r: 2, fill: '#2563eb' }}
            activeDot={{ r: 4 }}
            name="NDMI (moisture)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default NDVIChart

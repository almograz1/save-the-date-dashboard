import { useMemo, useState, useEffect } from 'react'

import farms from '../data/farms.json'
import tsNaama1 from '../data/ts_naama1.json'
import tsNaama2 from '../data/ts_naama2.json'
import tsNaama3 from '../data/timeseries.json'
import tsNaama4 from '../data/ts_naama4.json'

import {
  cleanData,
  detectStressZone,
  irrigationEffectiveness,
  fieldUniformity,
  seasonalPattern,
  detectAnomalies,
  currentVsExpected,
  recentTrend,
} from '../lib/analytics'
import { computeForecast } from '../lib/forecast'
import { fetchWeatherAndET } from '../lib/fetchET'
import { extendToToday, firstEstimatedDate } from '../lib/extendSeries'
import { generatePixelGrid } from '../lib/generatePixelGrid'
import { generateRecommendations } from '../lib/recommendations'

import AppShell from '../layout/AppShell'
import FarmSelector from '../features/farms/components/FarmSelector'
import OverviewPage from '../features/overview/OverviewPage'
import MapPage from '../features/field-map/MapPage'
import TrendsPage from '../features/trends/TrendsPage'
import ForecastPage from '../features/forecast/ForecastPage'
import AdvisorPage from '../features/advisor/AdvisorPage'
import { PAGES } from './routes'
import { useHashRoute } from './useHashRoute'

import './App.css'

const TS_BY_ID = {
  naama1: tsNaama1,
  naama2: tsNaama2,
  naama3: tsNaama3,
  naama4: tsNaama4,
}

function App() {
  const [selectedFarmId, setSelectedFarmId] = useState('naama3')
  const [weatherData, setWeatherData] = useState(null)

  useEffect(() => {
    fetchWeatherAndET()
      .then(setWeatherData)
      .catch((err) => console.warn('ET fetch failed — running without ET adjustment:', err))
  }, [])

  // Generate pixel grids once so switching blocks is instantaneous.
  const allPixelGrids = useMemo(
    () => Object.fromEntries(farms.map((farm) => [farm.id, generatePixelGrid(farm)])),
    []
  )

  const farm = farms.find((item) => item.id === selectedFarmId) ?? farms[0]
  const pixelGrid = allPixelGrids[farm.id]

  // The GEE export stopped after 2026-04-29; extend each block to today with
  // modeled observations so the dashboard reflects the current date while
  // clearly labelling generated points.
  const data = useMemo(
    () => extendToToday(TS_BY_ID[farm.id]),
    [farm.id]
  )
  const estimatedFrom = firstEstimatedDate(data)
  const clean = useMemo(() => cleanData(data), [data])

  const insights = useMemo(
    () => ({
      stressZone: detectStressZone(data),
      irrigation: irrigationEffectiveness(data),
      uniformity: fieldUniformity(data),
      seasonal: seasonalPattern(data),
      anomalies: detectAnomalies(data),
      currentVsExpected: currentVsExpected(data),
      trend: recentTrend(data),
    }),
    [data]
  )

  const forecast = useMemo(() => computeForecast(data, weatherData), [data, weatherData])
  const { irrigation, harvest } = forecast
  const recommendations = useMemo(
    () => generateRecommendations({ clean, insights, irrigation, harvest, pixelGrid, weatherData }),
    [clean, insights, irrigation, harvest, pixelGrid, weatherData]
  )

  const latestClean = clean[clean.length - 1]
  const route = useHashRoute('overview')
  const active = PAGES.some((page) => page.id === route) ? route : 'overview'

  const farmSelector = (
    <FarmSelector
      farms={farms}
      allPixelGrids={allPixelGrids}
      selectedId={farm.id}
      onChange={setSelectedFarmId}
    />
  )

  return (
    <AppShell
      pages={PAGES}
      active={active}
      farm={farm}
      clean={clean}
      data={data}
      insights={insights}
      estimatedFrom={estimatedFrom}
      farmSelector={farmSelector}
      weatherData={weatherData}
    >
      {active === 'overview' && (
        <OverviewPage clean={clean} insights={insights} latestClean={latestClean} />
      )}
      {active === 'map' && (
        <MapPage pixelGrid={pixelGrid} farm={farm} allFarms={farms} />
      )}
      {active === 'trends' && (
        <TrendsPage data={data} clean={clean} insights={insights} estimatedFrom={estimatedFrom} />
      )}
      {active === 'forecast' && (
        <ForecastPage forecast={forecast} irrigation={irrigation} harvest={harvest} />
      )}
      {active === 'advisor' && (
        <AdvisorPage recommendations={recommendations} insights={insights} clean={clean} />
      )}
    </AppShell>
  )
}

export default App

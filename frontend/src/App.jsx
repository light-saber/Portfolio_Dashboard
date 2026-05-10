import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Holdings from './pages/Holdings'
import Performance from './pages/Performance'
import Projections from './pages/Projections'
import Tax from './pages/Tax'
import Health from './pages/Health'
import { useAuthStatus, usePortfolio } from './hooks/usePortfolio'

function Shell({ darkMode, onToggleDark }) {
  const { data: portfolio } = usePortfolio()
  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-navy-950">
      <Sidebar />
      <div className="flex-1 ml-60 flex flex-col">
        <Header
          profile={portfolio?.profile}
          lastUpdated={portfolio?.last_updated}
          darkMode={darkMode}
          onToggleDark={onToggleDark}
        />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/holdings" element={<Holdings />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/projections" element={<Projections />} />
            <Route path="/tax" element={<Tax />} />
            <Route path="/health" element={<Health />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const [darkMode, setDarkMode] = useState(true)
  const { data: authData, isLoading: authLoading } = useAuthStatus()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="text-slate-400 text-sm flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
          Connecting to Kite MCP…
        </div>
      </div>
    )
  }

  if (!authData?.authenticated) {
    return (
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <Shell darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
    </BrowserRouter>
  )
}

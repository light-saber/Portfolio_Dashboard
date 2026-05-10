import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend
} from 'recharts'
import clsx from 'clsx'
import { usePortfolio, useAllBenchmarks } from '../hooks/usePortfolio'
import { formatINR, formatPct, pnlColor } from '../utils/format'
import { ChartSkeleton } from '../components/LoadingSkeleton'
import ErrorCard from '../components/ErrorCard'

const PERIODS = ['1M', '3M', '6M', '1Y', '3Y', 'Max']
const BENCHMARK_COLORS = {
  nifty50: '#f59e0b',
  nifty_midcap150: '#3b82f6',
  nifty_smallcap250: '#8b5cf6',
}
const BENCHMARK_LABELS = {
  nifty50: 'Nifty 50',
  nifty_midcap150: 'Nifty Midcap 150',
  nifty_smallcap250: 'Nifty Smallcap 250',
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-navy-900 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-slate-200 tabular-nums">{p.value?.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Performance() {
  const [period, setPeriod] = useState('1Y')
  const { data: portfolio, isLoading, isError, error, refetch } = usePortfolio()
  const { data: benchmarks, isLoading: benchLoading } = useAllBenchmarks(period)

  if (isError) return (
    <div className="p-6">
      <ErrorCard message={error?.response?.data?.detail || error?.message} onRetry={refetch} />
    </div>
  )

  const holdings = portfolio?.holdings || []

  // Best/worst performers by P&L %
  const sortedByPct = [...holdings].sort((a, b) => b.pnl_pct - a.pnl_pct)
  const top5 = sortedByPct.slice(0, 5)
  const worst5 = sortedByPct.slice(-5).reverse()
  const bestWorst = [
    ...top5.map(h => ({ name: h.name.slice(0, 20), pnl_pct: h.pnl_pct, type: 'best' })),
    ...worst5.map(h => ({ name: h.name.slice(0, 20), pnl_pct: h.pnl_pct, type: 'worst' })),
  ]

  // SIP vs lump sum — inferred: not determinable from holdings alone, show as N/A
  const sipData = [
    { name: 'Classification unavailable', value: 100 }
  ]

  // Build normalised benchmark chart data (index to 100)
  const buildNormalisedSeries = () => {
    if (!benchmarks) return []
    const keys = Object.keys(benchmarks)
    const allDates = new Set()
    keys.forEach(k => {
      (benchmarks[k]?.data || []).forEach(d => allDates.add(d.date))
    })
    const sorted = [...allDates].sort()
    return sorted.map(date => {
      const point = { date }
      keys.forEach(k => {
        const found = benchmarks[k]?.data?.find(d => d.date === date)
        if (found) point[k] = found.close
      })
      return point
    })
  }

  const normaliseToBase100 = (series) => {
    if (!series.length) return series
    const keys = Object.keys(BENCHMARK_COLORS)
    const base = {}
    // Find first valid value per key
    keys.forEach(k => {
      const first = series.find(d => d[k] != null)
      base[k] = first?.[k] || 1
    })
    return series.map(d => {
      const out = { date: d.date }
      keys.forEach(k => {
        if (d[k] != null) out[k] = parseFloat(((d[k] / base[k]) * 100).toFixed(2))
      })
      return out
    })
  }

  const benchSeries = normaliseToBase100(buildNormalisedSeries())
  const benchmarkSource = benchmarks
    ? Object.values(benchmarks)[0]?.source || 'Yahoo Finance'
    : 'Yahoo Finance'

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Performance Analysis</h1>
        <p className="text-sm text-slate-500 mt-0.5">Benchmark comparison and return attribution</p>
      </div>

      {/* Period Selector */}
      <div className="flex gap-1.5">
        {PERIODS.map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              period === p ? 'bg-gold-500 text-navy-950' : 'text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Benchmark Chart */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Index Benchmark Comparison</h3>
            <p className="text-xs text-slate-500 mt-0.5">Normalised to 100 at start of period</p>
          </div>
          <span className="text-xs text-slate-500">Source: {benchmarkSource}</span>
        </div>
        {benchLoading ? <ChartSkeleton height="h-72" /> : (
          benchSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={benchSeries} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false}
                  tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} domain={['auto', 'auto']}
                  tickFormatter={v => `${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 12 }}
                  formatter={(v) => BENCHMARK_LABELS[v] || v} />
                {Object.keys(BENCHMARK_COLORS).map(k => (
                  <Line key={k} type="monotone" dataKey={k} stroke={BENCHMARK_COLORS[k]}
                    dot={false} strokeWidth={2} name={k} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500 py-16 text-center">No benchmark data available for this period</p>
          )
        )}
      </div>

      {/* Best & Worst Performers */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">Best & Worst Performers</h3>
        {isLoading ? <ChartSkeleton height="h-52" /> : (
          bestWorst.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bestWorst} layout="vertical" margin={{ left: 10, right: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={130} />
                <Tooltip formatter={(v) => `${v.toFixed(2)}%`} contentStyle={{ background: '#0f2040', border: '1px solid #1e3a5f', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="pnl_pct" radius={[0, 4, 4, 0]} name="Return">
                  {bestWorst.map((d, i) => <Cell key={i} fill={d.pnl_pct >= 0 ? '#22c55e' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-500 py-10 text-center">No holdings data</p>
        )}
      </div>
    </div>
  )
}

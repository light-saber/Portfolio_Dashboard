import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { usePortfolio } from '../hooks/usePortfolio'
import { formatINR } from '../utils/format'

const SCENARIOS = [
  { key: 'conservative', label: 'Conservative', cagr: 0.08, color: '#3b82f6' },
  { key: 'moderate', label: 'Moderate', cagr: 0.11, color: '#f59e0b' },
  { key: 'aggressive', label: 'Aggressive', cagr: 0.14, color: '#22c55e' },
]
const INFLATION = 0.06
const HORIZONS = [3, 5, 10, 15]

function buildProjection(currentValue, monthlySIP, stepUpPct, years) {
  const data = []
  for (const s of SCENARIOS) {
    let corpus = currentValue
    let annualSIP = monthlySIP * 12
    for (let y = 1; y <= years; y++) {
      corpus = corpus * (1 + s.cagr) + annualSIP * (1 + s.cagr / 2)
      annualSIP *= (1 + stepUpPct / 100)
      data.push({ year: `Y${y}`, [s.key]: Math.round(corpus), scenario: s.key })
    }
  }
  // Restructure: one row per year with all scenarios
  const rows = []
  for (let y = 1; y <= years; y++) {
    const row = { year: `Y${y}` }
    for (const s of SCENARIOS) {
      let corpus = currentValue
      let annualSIP = monthlySIP * 12
      for (let i = 1; i <= y; i++) {
        corpus = corpus * (1 + s.cagr) + annualSIP * (1 + s.cagr / 2)
        annualSIP *= (1 + stepUpPct / 100)
      }
      row[s.key] = Math.round(corpus)
    }
    rows.push(row)
  }
  return rows
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-navy-900 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-slate-200 tabular-nums">{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Projections() {
  const { data: portfolio, isLoading } = usePortfolio()
  const [monthlySIP, setMonthlySIP] = useState(10000)
  const [stepUp, setStepUp] = useState(10)
  const [horizon, setHorizon] = useState(10)

  const currentValue = portfolio?.summary?.current_value || 0
  const projection = useMemo(
    () => buildProjection(currentValue, monthlySIP, stepUp, horizon),
    [currentValue, monthlySIP, stepUp, horizon]
  )

  const finalRow = projection[projection.length - 1] || {}

  // Inflation-adjusted final values
  const adjustedValues = Object.fromEntries(
    SCENARIOS.map(s => [
      s.key,
      Math.round(finalRow[s.key] / Math.pow(1 + INFLATION, horizon))
    ])
  )

  // Retirement readiness: rough heuristic — moderate scenario >= 5Cr
  const moderateCorpus = finalRow['moderate'] || 0
  const readinessPct = Math.min(100, (moderateCorpus / 5e7) * 100)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Future Projections</h1>
        <p className="text-sm text-slate-500 mt-0.5">Scenario-based corpus forecast with SIP step-up modelling</p>
      </div>

      {/* Inputs */}
      <div className="card grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-2">Monthly SIP (₹)</label>
          <input
            type="number"
            value={monthlySIP}
            onChange={e => setMonthlySIP(Number(e.target.value))}
            min={0}
            step={500}
            className="w-full bg-white border border-slate-300 text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500 tabular-nums"
          />
          <p className="text-xs text-slate-500 mt-1">{formatINR(monthlySIP)} per month</p>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-2">Annual Step-Up: {stepUp}%</label>
          <input
            type="range"
            min={0} max={30} step={1}
            value={stepUp}
            onChange={e => setStepUp(Number(e.target.value))}
            className="w-full accent-gold-500"
          />
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>0%</span><span>30%</span>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-2">Projection Horizon</label>
          <div className="flex gap-2">
            {HORIZONS.map(h => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  horizon === h ? 'bg-gold-500 text-navy-950' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {h}Y
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Current corpus */}
      <div className="card flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gold-500/15 flex items-center justify-center">
          <span className="text-lg">💼</span>
        </div>
        <div>
          <p className="text-xs text-slate-400">Current Portfolio Value (Base)</p>
          <p className="text-xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{isLoading ? '—' : formatINR(currentValue)}</p>
        </div>
      </div>

      {/* Area Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Corpus Projection — {horizon} Years</h3>
          <span className="text-xs text-slate-500">Assumptions: {stepUp}% annual SIP step-up, 6% inflation</span>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={projection} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <defs>
              {SCENARIOS.map(s => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false}
              tickFormatter={v => formatINR(v)} width={70} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 12 }} />
            {SCENARIOS.map(s => (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.label}
                stroke={s.color} strokeWidth={2} fill={`url(#grad-${s.key})`} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Output Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SCENARIOS.map(s => (
          <div key={s.key} className="card border" style={{ borderColor: `${s.color}30` }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: s.color }}>
              {s.label} ({(s.cagr * 100).toFixed(0)}% CAGR)
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{formatINR(finalRow[s.key])}</p>
            <p className="text-xs text-slate-500 mt-1">In {horizon} years</p>
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">Inflation-adjusted (6% p.a.)</p>
              <p className="text-sm font-semibold text-slate-300 tabular-nums mt-0.5">{formatINR(adjustedValues[s.key])}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Retirement Readiness */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
          Retirement Readiness
          <span className="text-xs font-normal text-slate-500 ml-2">— based on ₹5Cr moderate scenario target</span>
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-400 transition-all duration-500"
              style={{ width: `${readinessPct}%` }}
            />
          </div>
          <span className="text-sm font-bold text-gold-400 tabular-nums w-12">{readinessPct.toFixed(0)}%</span>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Moderate scenario corpus in {horizon}Y: {formatINR(moderateCorpus)} of ₹5Cr target
        </p>
      </div>
    </div>
  )
}

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts'
import KPICard from '../components/KPICard'
import { KPICardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton'
import ErrorCard from '../components/ErrorCard'
import { formatINR, formatPct } from '../utils/format'
import { usePortfolio } from '../hooks/usePortfolio'

const COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280']
const CAP_COLORS = { 'Large Cap': '#3b82f6', 'Mid Cap': '#f59e0b', 'Small Cap': '#ef4444', 'Other': '#6b7280' }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-navy-900 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-300 font-medium mb-1">{label || payload[0]?.name}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value?.toFixed(1)}%</p>
      ))}
    </div>
  )
}

const RADIAN = Math.PI / 180
const RenderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, percent }) => {
  if (percent < 0.05) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export default function Overview() {
  const { data: portfolio, isLoading, isError, error, refetch } = usePortfolio()

  if (isError) return (
    <div className="p-6">
      <ErrorCard message={error?.response?.data?.detail || error?.message} onRetry={refetch} />
    </div>
  )

  const s = portfolio?.summary

  const allocationData = s ? [
    { name: 'Equity', value: s.equity_value },
    { name: 'Mutual Funds', value: s.mf_value },
    { name: 'ETFs', value: s.etf_value },
    { name: 'SGBs', value: s.sgb_value },
    { name: 'Cash', value: s.cash_value },
  ].filter(d => d.value > 0).map(d => ({
    ...d,
    pct: s.current_value ? (d.value / s.current_value * 100) : 0
  })) : []

  const equityDebtData = s ? [
    { name: 'Equity', value: parseFloat(s.equity_pct?.toFixed(1) || 0) },
    { name: 'Debt', value: parseFloat(s.debt_pct?.toFixed(1) || 0) },
    { name: 'Cash', value: parseFloat(((s.cash_value / s.current_value) * 100)?.toFixed(1) || 0) },
  ].filter(d => d.value > 0) : []

  const capData = s ? [
    { name: 'Large Cap', value: parseFloat(s.large_cap_pct?.toFixed(1) || 0) },
    { name: 'Mid Cap', value: parseFloat(s.mid_cap_pct?.toFixed(1) || 0) },
    { name: 'Small Cap', value: parseFloat(s.small_cap_pct?.toFixed(1) || 0) },
  ].filter(d => d.value > 0) : []

  const geoData = s ? [
    { name: 'Domestic', value: parseFloat(s.domestic_pct?.toFixed(1) || 0) },
    { name: 'International', value: parseFloat(s.international_pct?.toFixed(1) || 0) },
  ].filter(d => d.value > 0) : []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Portfolio Overview</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your complete investment picture at a glance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <KPICard
              title="Total Invested"
              value={formatINR(s?.total_invested)}
              tooltip="Sum of (avg buy price × units) for all holdings"
            />
            <KPICard
              title="Current Value"
              value={formatINR(s?.current_value)}
              tooltip="Sum of (current price × units) across all holdings + cash"
            />
            <KPICard
              title="Total P&L"
              value={formatINR(s?.total_pnl)}
              delta={s?.total_pnl_pct}
              deltaLabel="overall return"
              tooltip="Unrealised gain/loss — current value minus invested amount"
            />
            <KPICard
              title="Today's Change"
              value={formatINR(s?.day_change)}
              delta={s?.day_change_pct}
              deltaLabel="vs yesterday"
              tooltip="Day change aggregated across all holdings"
            />
            <KPICard
              title="Portfolio XIRR"
              value={s?.xirr != null ? `${s.xirr}%` : 'N/A'}
              sub={s?.xirr == null ? 'Insufficient transaction history' : 'Annualised return'}
              tooltip="Extended Internal Rate of Return via Newton-Raphson. Confidence improves with more transaction history."
            />
            <KPICard
              title="Risk Score"
              value={s?.risk_score != null ? `${s.risk_score} / 10` : '—'}
              sub="Based on allocation & cap exposure"
              tooltip="Heuristic score (1=low risk, 10=high risk) based on small-cap exposure, concentration, and debt allocation."
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Asset Allocation */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Asset Allocation</h3>
            <span className="text-xs text-slate-500">Source: Kite MCP</span>
          </div>
          {isLoading ? <ChartSkeleton height="h-52" /> : (
            allocationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={allocationData} dataKey="pct" nameKey="name" cx="50%" cy="50%"
                    innerRadius={55} outerRadius={90} labelLine={false} label={RenderCustomLabel}>
                    {allocationData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} formatter={(v) => `${v.toFixed(1)}%`} />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-slate-500 py-10 text-center">No holdings data</p>
          )}
        </div>

        {/* Equity vs Debt */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Equity vs Debt Split</h3>
            <span className="text-xs text-slate-500">Source: Kite MCP</span>
          </div>
          {isLoading ? <ChartSkeleton height="h-52" /> : (
            equityDebtData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={equityDebtData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={55} outerRadius={90} labelLine={false} label={RenderCustomLabel}>
                    {equityDebtData.map((_, i) => <Cell key={i} fill={['#f59e0b', '#3b82f6', '#6b7280'][i]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} formatter={(v) => `${v}%`} />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-slate-500 py-10 text-center">No data</p>
          )}
        </div>

        {/* Cap Exposure */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Market Cap Exposure</h3>
            <span className="text-xs text-slate-500">Source: Kite MCP (inferred)</span>
          </div>
          {isLoading ? <ChartSkeleton height="h-32" /> : (
            capData.length > 0 ? (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={capData} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={75} />
                  <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#0f2040', border: '1px solid #1e3a5f', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {capData.map((d, i) => <Cell key={i} fill={CAP_COLORS[d.name] || '#6b7280'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-slate-500 py-6 text-center">No data</p>
          )}
        </div>

        {/* Geographic */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Domestic vs International</h3>
            <span className="text-xs text-slate-500">Source: Kite MCP (inferred)</span>
          </div>
          {isLoading ? <ChartSkeleton height="h-52" /> : (
            geoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={geoData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={55} outerRadius={90} labelLine={false} label={RenderCustomLabel}>
                    {geoData.map((_, i) => <Cell key={i} fill={['#f59e0b', '#8b5cf6'][i]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#0f2040', border: '1px solid #1e3a5f', borderRadius: 8, fontSize: 12 }} />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-slate-500 py-10 text-center">No data</p>
          )}
        </div>
      </div>
    </div>
  )
}

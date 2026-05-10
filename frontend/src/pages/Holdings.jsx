import { useState } from 'react'
import { AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react'
import clsx from 'clsx'
import { usePortfolio } from '../hooks/usePortfolio'
import { formatINR, formatPct, pnlColor } from '../utils/format'
import { TableSkeleton } from '../components/LoadingSkeleton'
import ErrorCard from '../components/ErrorCard'

const TABS = ['Mutual Funds', 'Equities', 'ETFs', 'SGBs']
const TYPE_MAP = { 'Mutual Funds': 'mf', Equities: 'equity', ETFs: 'etf', SGBs: 'sgb' }

function SortIcon({ field, sort }) {
  if (sort.field !== field) return null
  return sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
}

function HoldingsTable({ holdings, totalValue }) {
  const [sort, setSort] = useState({ field: 'current_value', dir: 'desc' })

  const toggle = (field) => setSort(s => ({
    field,
    dir: s.field === field && s.dir === 'desc' ? 'asc' : 'desc'
  }))

  const sorted = [...holdings].sort((a, b) => {
    const av = a[sort.field] ?? 0, bv = b[sort.field] ?? 0
    return sort.dir === 'asc' ? av - bv : bv - av
  })

  const Th = ({ field, label }) => (
    <th className={clsx('th cursor-pointer select-none hover:text-slate-200 transition-colors')} onClick={() => toggle(field)}>
      <span className="inline-flex items-center gap-1 justify-end">
        {label} <SortIcon field={field} sort={sort} />
      </span>
    </th>
  )

  if (!holdings.length) return (
    <div className="py-16 text-center text-slate-500 text-sm">No holdings in this category</div>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th className="th text-left">Name</th>
            <th className="th text-left">Category</th>
            <Th field="units" label="Units" />
            <Th field="avg_buy_price" label="Avg Price" />
            <Th field="current_price" label="CMP" />
            <Th field="invested" label="Invested" />
            <Th field="current_value" label="Value" />
            <Th field="pnl" label="P&L" />
            <Th field="pnl_pct" label="P&L %" />
            <th className="th">% of Portfolio</th>
            <Th field="day_change" label="Day Change" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((h, i) => {
            const holdingPct = totalValue ? (h.current_value / totalValue * 100) : 0
            const highConc = holdingPct > 15
            return (
              <tr key={i} className="table-row">
                <td className="td font-medium max-w-[180px]">
                  <span className="truncate block" title={h.name}>{h.name}</span>
                  {h.isin && <span className="text-xs text-slate-600">{h.isin}</span>}
                </td>
                <td className="td text-left">
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-500 dark:text-slate-400">{h.category || '—'}</span>
                </td>
                <td className="td tabular-nums">{h.units?.toFixed(3)}</td>
                <td className="td tabular-nums">{formatINR(h.avg_buy_price, { compact: false })}</td>
                <td className="td tabular-nums">{formatINR(h.current_price, { compact: false })}</td>
                <td className="td tabular-nums">{formatINR(h.invested)}</td>
                <td className="td tabular-nums font-medium">{formatINR(h.current_value)}</td>
                <td className={clsx('td tabular-nums font-medium', pnlColor(h.pnl))}>
                  {formatINR(h.pnl, { sign: true })}
                </td>
                <td className={clsx('td tabular-nums', pnlColor(h.pnl_pct))}>
                  {formatPct(h.pnl_pct)}
                </td>
                <td className="td tabular-nums">
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full', highConc ? 'bg-red-500/20 text-red-400' : 'text-slate-400')}>
                    {holdingPct.toFixed(1)}%
                    {highConc && ' ⚠'}
                  </span>
                </td>
                <td className={clsx('td tabular-nums', pnlColor(h.day_change))}>
                  {h.day_change != null ? formatINR(h.day_change, { sign: true }) : '—'}
                  {h.day_change_pct != null && (
                    <span className="text-xs ml-1">({formatPct(h.day_change_pct)})</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function Holdings() {
  const [activeTab, setActiveTab] = useState('Mutual Funds')
  const { data: portfolio, isLoading, isError, error, refetch } = usePortfolio()

  if (isError) return (
    <div className="p-6">
      <ErrorCard message={error?.response?.data?.detail || error?.message} onRetry={refetch} />
    </div>
  )

  const holdings = portfolio?.holdings || []
  const totalValue = portfolio?.summary?.current_value || 0
  const typeKey = TYPE_MAP[activeTab]
  const filtered = holdings.filter(h => h.instrument_type === typeKey)

  const overlapWarnings = portfolio?.overlap_warnings || []
  const concentrationFlags = portfolio?.concentration_flags || []

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Holdings Breakdown</h1>
        <p className="text-sm text-slate-500 mt-0.5">Detailed view of all positions with sortable columns</p>
      </div>

      {/* Warnings */}
      {(overlapWarnings.length > 0 || concentrationFlags.length > 0) && (
        <div className="space-y-2">
          {overlapWarnings.map((w, i) => (
            <div key={i} className="flex gap-2 items-start p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
              <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
              <span className="text-amber-200">{w}</span>
            </div>
          ))}
          {concentrationFlags.map((f, i) => (
            <div key={i} className="flex gap-2 items-start p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm">
              <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <span className="text-red-200">{f}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx('tab-btn', activeTab === tab && 'active')}
          >
            {tab}
            {!isLoading && (
              <span className="ml-1.5 text-xs opacity-60">
                ({holdings.filter(h => h.instrument_type === TYPE_MAP[tab]).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-4"><TableSkeleton rows={8} /></div>
        ) : (
          <HoldingsTable holdings={filtered} totalValue={totalValue} />
        )}
      </div>

      {/* XIRR per holding */}
      {portfolio?.xirr_per_holding && Object.keys(portfolio.xirr_per_holding).length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
            XIRR per Holding
            <span className="text-xs font-normal text-slate-500 ml-2">— single buy-and-hold approximation; incomplete transaction history may affect accuracy</span>
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {Object.entries(portfolio.xirr_per_holding)
              .filter(([, v]) => v != null)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 12)
              .map(([name, xirr]) => (
                <div key={name} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                  <span className="text-xs text-slate-400 truncate mr-2" title={name}>{name}</span>
                  <span className={clsx('text-xs font-semibold tabular-nums shrink-0', pnlColor(xirr))}>{xirr}%</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

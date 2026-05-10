import { AlertTriangle, Info, TrendingDown, RefreshCw } from 'lucide-react'
import { usePortfolio } from '../hooks/usePortfolio'
import { formatINR, formatPct, pnlColor } from '../utils/format'
import ErrorCard from '../components/ErrorCard'
import { KPICardSkeleton } from '../components/LoadingSkeleton'
import clsx from 'clsx'

const LTCG_THRESHOLD = 100000  // INR 1L exemption limit per FY
const LTCG_RATE = 0.125        // 12.5% for equity (Budget 2024)
const STCG_RATE = 0.20         // 20% for equity (Budget 2024)
const HOLDING_PERIOD_DAYS = 365

function computeTaxSummary(holdings) {
  const today = new Date()
  let ltcg_unrealised = 0
  let stcg_unrealised = 0
  let ltcg_equity = 0
  let stcg_equity = 0

  const harvestCandidates = []
  const rebalanceAlerts = []

  for (const h of holdings) {
    if (h.pnl >= 0) {
      if (h.instrument_type === 'equity' || h.instrument_type === 'etf' || h.instrument_type === 'mf') {
        // Cannot determine exact buy date without order history — estimate
        ltcg_unrealised += h.pnl * 0.5  // assume half long-term (heuristic)
        stcg_unrealised += h.pnl * 0.5
      }
    } else {
      // Loss — potential harvesting candidate
      if (Math.abs(h.pnl) >= 5000) {
        harvestCandidates.push(h)
      }
    }
  }

  const ltcg_taxable = Math.max(0, ltcg_unrealised - LTCG_THRESHOLD)
  const ltcg_tax = ltcg_taxable * LTCG_RATE
  const stcg_tax = stcg_unrealised * STCG_RATE

  return {
    ltcg_unrealised,
    stcg_unrealised,
    ltcg_taxable,
    ltcg_tax,
    stcg_tax,
    harvestCandidates,
    totalTaxLiability: ltcg_tax + stcg_tax,
  }
}

export default function Tax() {
  const { data: portfolio, isLoading, isError, error, refetch } = usePortfolio()

  if (isError) return (
    <div className="p-6">
      <ErrorCard message={error?.response?.data?.detail || error?.message} onRetry={refetch} />
    </div>
  )

  const holdings = portfolio?.holdings || []
  const tax = computeTaxSummary(holdings)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Tax & Optimization</h1>
        <p className="text-sm text-slate-500 mt-0.5">FY 2025-26 — Indian tax rules (LTCG / STCG)</p>
      </div>

      {/* FY Disclaimer */}
      <div className="flex gap-2 items-start p-3.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm">
        <Info size={15} className="text-blue-400 shrink-0 mt-0.5" />
        <div className="text-blue-200 text-xs space-y-0.5">
          <p className="font-semibold text-blue-300">FY 2025-26 Tax Rules Applied</p>
          <p>Equity LTCG (&gt;1 year): 12.5% above ₹1L exemption. STCG (&lt;1 year): 20%. Debt MF: slab rate.</p>
          <p className="text-blue-400">Note: Exact holding periods require full transaction history. Estimates below use portfolio P&L as a proxy.</p>
        </div>
      </div>

      {/* Tax Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <div className="card">
              <p className="text-xs text-slate-400 uppercase tracking-wider">LTCG Unrealised</p>
              <p className="text-xl font-semibold text-slate-100 mt-2 tabular-nums">{formatINR(tax.ltcg_unrealised)}</p>
              <p className="text-xs text-slate-500 mt-1">Above ₹1L threshold: {formatINR(Math.max(0, tax.ltcg_taxable))}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-400 uppercase tracking-wider">STCG Unrealised</p>
              <p className="text-xl font-semibold text-slate-100 mt-2 tabular-nums">{formatINR(tax.stcg_unrealised)}</p>
              <p className="text-xs text-slate-500 mt-1">Rate: 20% (equity)</p>
            </div>
            <div className="card border-amber-500/20">
              <p className="text-xs text-amber-400 uppercase tracking-wider">Est. LTCG Tax</p>
              <p className="text-xl font-semibold text-amber-300 mt-2 tabular-nums">{formatINR(tax.ltcg_tax)}</p>
              <p className="text-xs text-slate-500 mt-1">12.5% on {formatINR(tax.ltcg_taxable)} taxable</p>
            </div>
            <div className="card border-amber-500/20">
              <p className="text-xs text-amber-400 uppercase tracking-wider">Est. Total Liability</p>
              <p className="text-xl font-semibold text-amber-300 mt-2 tabular-nums">{formatINR(tax.totalTaxLiability)}</p>
              <p className="text-xs text-slate-500 mt-1">Unrealised — no transaction yet</p>
            </div>
          </>
        )}
      </div>

      {/* Tax Breakdown */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Tax Rate Reference — FY 2025-26</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="th text-left">Instrument</th>
                <th className="th">Holding Period</th>
                <th className="th">Classification</th>
                <th className="th">Tax Rate</th>
                <th className="th">Exemption</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Equity / ETF', '> 1 year', 'LTCG', '12.5%', '₹1L / FY'],
                ['Equity / ETF', '< 1 year', 'STCG', '20%', 'None'],
                ['Equity MF', '> 1 year', 'LTCG', '12.5%', '₹1L / FY'],
                ['Equity MF', '< 1 year', 'STCG', '20%', 'None'],
                ['Debt MF (post-Apr 2023)', 'Any', 'Income', 'Slab rate', 'None'],
                ['SGB', 'On maturity', 'Tax-free', '0%', 'Full'],
              ].map(([inst, period, cls, rate, exempt], i) => (
                <tr key={i} className="table-row">
                  <td className="td font-medium">{inst}</td>
                  <td className="td">{period}</td>
                  <td className="td">
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full', cls === 'LTCG' ? 'bg-blue-500/20 text-blue-300' : cls === 'STCG' ? 'bg-amber-500/20 text-amber-300' : cls === 'Tax-free' ? 'bg-green-500/20 text-green-300' : 'bg-slate-700 text-slate-400')}>
                      {cls}
                    </span>
                  </td>
                  <td className="td font-semibold text-slate-200">{rate}</td>
                  <td className="td text-green-400">{exempt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax Harvesting Opportunities */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Tax Harvesting Opportunities</h3>
        <p className="text-xs text-slate-500 mb-4">Holdings with unrealised losses that can offset gains before FY-end</p>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />)}</div>
        ) : tax.harvestCandidates.length > 0 ? (
          <div className="space-y-2">
            {tax.harvestCandidates.map((h, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                <div>
                  <p className="text-sm font-medium text-slate-200">{h.name}</p>
                  <p className="text-xs text-slate-500">{h.category} · {h.instrument_type.toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-red-400 tabular-nums">{formatINR(h.pnl)}</p>
                  <p className="text-xs text-slate-500">{formatPct(h.pnl_pct)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 py-4">No significant loss positions identified for harvesting.</p>
        )}
      </div>

      {/* Rebalancing Alerts */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Rebalancing Alerts</h3>
        <p className="text-xs text-slate-500 mb-4">Holdings that have drifted &gt;5% from target allocation</p>
        {isLoading ? null : (
          portfolio?.concentration_flags?.length > 0 ? (
            <div className="space-y-2">
              {portfolio.concentration_flags.map((f, i) => (
                <div key={i} className="flex gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <span className="text-xs text-amber-200">{f}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-green-400 py-2">✓ No significant concentration issues detected.</p>
          )
        )}
      </div>

      {/* AI Recommendations placeholder */}
      <div className="card border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🤖</span>
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">AI Recommendations</h3>
          <span className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">Coming soon</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-600">Claude API-powered recommendations (funds to increase/exit, overlaps to consolidate) will appear here.</p>
      </div>
    </div>
  )
}

import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import { usePortfolio } from '../hooks/usePortfolio'
import { KPICardSkeleton } from '../components/LoadingSkeleton'
import ErrorCard from '../components/ErrorCard'

function computeScores(portfolio) {
  const s = portfolio?.summary || {}
  const holdings = portfolio?.holdings || []
  const total = s.current_value || 1

  // Diversification: penalise for too few holdings or extreme concentration
  const numHoldings = holdings.length
  let diversification = 5
  if (numHoldings >= 15) diversification = 9
  else if (numHoldings >= 8) diversification = 7
  else if (numHoldings >= 4) diversification = 5
  else diversification = 3
  const maxPct = Math.max(...holdings.map(h => h.current_value / total * 100), 0)
  if (maxPct > 30) diversification = Math.max(1, diversification - 2)
  else if (maxPct > 20) diversification = Math.max(1, diversification - 1)

  // Risk-adjusted return: ratio of XIRR to risk score proxy
  const xirr = s.xirr || 0
  const riskScore = s.risk_score || 5
  let riskAdjusted = 5
  if (xirr > 15 && riskScore < 6) riskAdjusted = 9
  else if (xirr > 10) riskAdjusted = 7
  else if (xirr > 5) riskAdjusted = 5
  else riskAdjusted = 3

  // Tax efficiency: SGBs and ELSS get bonus
  const sgbPct = s.sgb_value / total * 100
  const elssValue = holdings.filter(h => h.category === 'ELSS').reduce((acc, h) => acc + h.current_value, 0)
  const elssPct = elssValue / total * 100
  let taxEff = 5
  if (sgbPct + elssPct > 20) taxEff = 8
  else if (sgbPct + elssPct > 10) taxEff = 6
  else if (s.debt_pct > 20) taxEff = 4

  // Liquidity: equity + ETF + liquid MF = high liquidity
  const equityLiquid = (s.equity_value + s.etf_value) / total * 100
  let liquidity = 7
  if (equityLiquid > 60) liquidity = 9
  else if (equityLiquid > 30) liquidity = 7
  else liquidity = 4

  const overall = Math.round((diversification + riskAdjusted + taxEff + liquidity) / 4 * 10) / 10

  return { overall, diversification, riskAdjusted, taxEff, liquidity }
}

function computeStrengths(portfolio, scores) {
  const s = portfolio?.summary || {}
  const strengths = []

  if (s.xirr > 12) strengths.push('Strong portfolio XIRR above 12% — outpacing most fixed-income alternatives')
  if (s.international_pct > 5) strengths.push('International diversification reduces India-specific risk')
  if (scores.diversification >= 7) strengths.push('Well-diversified across instruments — reduces single-point-of-failure risk')
  if (s.sgb_value > 0) strengths.push('SGB holdings are tax-free at maturity — excellent for long-term gold exposure')
  if (s.debt_pct > 10) strengths.push('Debt allocation provides stability and rebalancing buffer')
  if (s.total_pnl > 0) strengths.push(`Portfolio in overall profit — unrealised gains of ₹${(s.total_pnl / 1e5).toFixed(1)}L`)

  return strengths.slice(0, 5)
}

function computeWeaknesses(portfolio, scores) {
  const s = portfolio?.summary || {}
  const holdings = portfolio?.holdings || []
  const total = s.current_value || 1
  const weaknesses = []

  if (s.small_cap_pct > 40) weaknesses.push('Heavy small-cap exposure (>40%) creates high volatility risk')
  if (s.debt_pct < 5 && s.cash_value < 10000) weaknesses.push('No meaningful debt or cash allocation — no buffer during equity drawdowns')
  if (scores.diversification < 5) weaknesses.push('Insufficient diversification — portfolio concentrated in too few instruments')
  if ((portfolio?.overlap_warnings || []).length > 0) weaknesses.push('Fund overlap detected — multiple funds may hold identical underlying stocks')
  if (s.international_pct < 3) weaknesses.push('No international exposure — fully correlated to Indian market cycles')
  if ((portfolio?.concentration_flags || []).length > 0) weaknesses.push('High concentration in single holdings (>15%) amplifies drawdown risk')

  return weaknesses.slice(0, 5)
}

function computeActions(portfolio, scores) {
  const s = portfolio?.summary || {}
  const actions = []

  if ((portfolio?.overlap_warnings || []).length > 0)
    actions.push('Consolidate overlapping flexi/multi-cap funds into a single index fund to reduce cost and overlap')
  if (s.debt_pct < 10)
    actions.push('Add debt allocation (short-term debt fund or liquid fund) to reach 10–20% for stability')
  if ((portfolio?.concentration_flags || []).length > 0)
    actions.push('Trim holdings above 15% portfolio weight and redeploy into under-represented asset classes')
  if (s.international_pct < 3)
    actions.push('Consider adding a US/global index fund for geographic diversification')
  if (s.sgb_value === 0)
    actions.push('Explore Sovereign Gold Bonds (SGB) as a tax-efficient alternative to physical gold or gold ETFs')

  return actions.slice(0, 5)
}

const ScoreBar = ({ score, label, tooltip }) => {
  const color = score >= 7 ? 'bg-green-500' : score >= 5 ? 'bg-gold-500' : 'bg-red-500'
  return (
    <div className="group relative">
      {tooltip && (
        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-52 bg-navy-800 text-xs text-slate-300 rounded-lg p-2.5 border border-slate-700 shadow-xl">
          {tooltip}
        </div>
      )}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-400 cursor-default">{label}</span>
        <span className="text-sm font-bold text-slate-200 tabular-nums">{score} / 10</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all duration-700', color)} style={{ width: `${score * 10}%` }} />
      </div>
    </div>
  )
}

export default function Health() {
  const { data: portfolio, isLoading, isError, error, refetch } = usePortfolio()

  if (isError) return (
    <div className="p-6">
      <ErrorCard message={error?.response?.data?.detail || error?.message} onRetry={refetch} />
    </div>
  )

  const scores = isLoading ? {} : computeScores(portfolio)
  const strengths = isLoading ? [] : computeStrengths(portfolio, scores)
  const weaknesses = isLoading ? [] : computeWeaknesses(portfolio, scores)
  const actions = isLoading ? [] : computeActions(portfolio, scores)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Portfolio Health Report</h1>
        <p className="text-sm text-slate-500 mt-0.5">Comprehensive scorecard and actionable insights</p>
      </div>

      {/* Overall Score */}
      {!isLoading && (
        <div className="card bg-gradient-to-br from-navy-900 to-navy-800 border-gold-500/20">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full border-4 border-gold-500 flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-gold-400">{scores.overall}</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall Portfolio Rating</p>
              <p className="text-2xl font-bold text-slate-100 mt-0.5">
                {scores.overall >= 7 ? 'Good' : scores.overall >= 5 ? 'Fair' : 'Needs Attention'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Composite of diversification, risk-adjusted return, tax efficiency, and liquidity</p>
            </div>
          </div>
        </div>
      )}

      {/* Scorecard */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">
          Scorecard
          <span className="text-xs font-normal text-slate-500 ml-2">— hover for methodology</span>
        </h3>
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 bg-slate-800 animate-pulse rounded" />)}</div>
        ) : (
          <div className="space-y-5">
            <ScoreBar score={scores.diversification} label="Diversification Quality"
              tooltip="Based on number of holdings, maximum single-holding concentration, and instrument type variety." />
            <ScoreBar score={scores.riskAdjusted} label="Risk-Adjusted Return Quality"
              tooltip="Ratio of portfolio XIRR to risk score. Higher XIRR with lower risk scores produce better scores." />
            <ScoreBar score={scores.taxEff} label="Tax Efficiency"
              tooltip="Measures presence of tax-efficient instruments: SGB (tax-free at maturity), ELSS (80C deduction), and long-term equity." />
            <ScoreBar score={scores.liquidity} label="Liquidity Score"
              tooltip="Proportion of portfolio in liquid instruments (equity, ETF). Debt funds have T+1 liquidity; real estate has none." />
          </div>
        )}
      </div>

      {/* Strengths / Weaknesses / Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-1.5">
            <CheckCircle size={14} /> Top Strengths
          </h3>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 bg-slate-800 animate-pulse rounded" />)}</div>
          ) : strengths.length > 0 ? (
            <ul className="space-y-2">
              {strengths.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-300">
                  <span className="text-green-400 shrink-0 mt-0.5">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-slate-500">Insufficient data to identify strengths.</p>}
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-1.5">
            <XCircle size={14} /> Top Weaknesses
          </h3>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 bg-slate-800 animate-pulse rounded" />)}</div>
          ) : weaknesses.length > 0 ? (
            <ul className="space-y-2">
              {weaknesses.map((w, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-300">
                  <span className="text-red-400 shrink-0 mt-0.5">✕</span>
                  {w}
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-slate-500">No major weaknesses identified.</p>}
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gold-400 mb-3 flex items-center gap-1.5">
            <AlertCircle size={14} /> Immediate Actions
          </h3>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 bg-slate-800 animate-pulse rounded" />)}</div>
          ) : actions.length > 0 ? (
            <ol className="space-y-2">
              {actions.map((a, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-300">
                  <span className="text-gold-400 shrink-0 font-bold">{i + 1}.</span>
                  {a}
                </li>
              ))}
            </ol>
          ) : <p className="text-xs text-slate-500">No immediate actions required.</p>}
        </div>
      </div>

      {/* AI Summary placeholder */}
      <div className="card border-dashed border-slate-700 bg-slate-900/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🤖</span>
          <h3 className="text-sm font-semibold text-slate-400">Plain-English Portfolio Summary</h3>
          <span className="text-xs bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">Claude API — coming soon</span>
        </div>
        <p className="text-xs text-slate-600">A 2–3 paragraph executive summary generated by Claude API (streaming) will appear here.</p>
      </div>
    </div>
  )
}

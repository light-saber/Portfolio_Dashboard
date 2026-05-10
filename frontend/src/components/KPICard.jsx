import clsx from 'clsx'
import { TrendingUp, TrendingDown } from 'lucide-react'

export default function KPICard({ title, value, sub, delta, deltaLabel, tooltip }) {
  const isPositive = delta > 0
  const isNegative = delta < 0

  return (
    <div className="card flex flex-col gap-2 group relative">
      {tooltip && (
        <div className="absolute top-3 right-3 hidden group-hover:block z-10 w-48 bg-navy-800 text-xs text-slate-300 rounded-lg p-2.5 border border-slate-700 shadow-xl">
          {tooltip}
        </div>
      )}
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-semibold text-slate-100 tabular-nums">{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
      {delta !== undefined && delta !== null && (
        <div className={clsx('flex items-center gap-1 text-xs font-medium', isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-slate-400')}>
          {isPositive ? <TrendingUp size={12} /> : isNegative ? <TrendingDown size={12} /> : null}
          {isPositive ? '+' : ''}{delta?.toFixed(2)}% {deltaLabel && <span className="text-slate-500 font-normal ml-1">{deltaLabel}</span>}
        </div>
      )}
    </div>
  )
}

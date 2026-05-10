import { RefreshCw, Sun, Moon } from 'lucide-react'
import clsx from 'clsx'
import { formatDate, isMarketOpen } from '../utils/format'
import { useRefresh } from '../hooks/usePortfolio'

export default function Header({ profile, lastUpdated, darkMode, onToggleDark }) {
  const { mutate: refresh, isPending } = useRefresh()
  const marketOpen = isMarketOpen()

  const name = profile?.user_name || profile?.name || 'Investor'

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 bg-navy-950/80 backdrop-blur border-b border-slate-800">
      <div className="flex items-center gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-100">{name}</p>
          <p className="text-xs text-slate-500">
            Last updated: {lastUpdated ? formatDate(lastUpdated) : 'Never'}
          </p>
        </div>
        <span className={clsx(marketOpen ? 'badge-open' : 'badge-closed')}>
          {marketOpen ? '● MARKET OPEN' : '● MARKET CLOSED'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => refresh()}
          disabled={isPending}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-gold-400 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={clsx(isPending && 'animate-spin')} />
          Refresh
        </button>
        <button
          onClick={onToggleDark}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  )
}

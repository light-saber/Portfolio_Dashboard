import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ErrorCard({ message, onRetry }) {
  return (
    <div className="card border-red-500/20 bg-red-900/10 flex items-start gap-3">
      <AlertTriangle size={18} className="text-red-400 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-red-400">Error loading data</p>
        <p className="text-xs text-slate-400 mt-1">{message || 'Something went wrong.'}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        )}
      </div>
    </div>
  )
}

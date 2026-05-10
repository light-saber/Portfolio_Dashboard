import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, BarChart2, TrendingUp, Calculator,
  Receipt, Activity, Zap
} from 'lucide-react'
import clsx from 'clsx'

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/holdings', icon: BarChart2, label: 'Holdings' },
  { to: '/performance', icon: TrendingUp, label: 'Performance' },
  { to: '/projections', icon: Calculator, label: 'Projections' },
  { to: '/tax', icon: Receipt, label: 'Tax & Optim.' },
  { to: '/health', icon: Activity, label: 'Health Report' },
]

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-white border-r border-slate-200 flex flex-col z-40 dark:bg-navy-900 dark:border-slate-800">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gold-500 flex items-center justify-center">
            <Zap size={16} className="text-navy-950" fill="currentColor" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-none">Kite Portfolio</p>
            <p className="text-xs text-slate-500 mt-0.5">Dashboard</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-gold-500/15 text-gold-600 border border-gold-500/20 dark:text-gold-400'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/60'
              )
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-800">
        <p className="text-xs text-slate-400 dark:text-slate-600">Powered by Zerodha Kite MCP</p>
      </div>
    </aside>
  )
}

export function formatINR(value, opts = {}) {
  if (value === null || value === undefined || isNaN(value)) return '—'
  const { compact = true, sign = false } = opts
  const abs = Math.abs(value)
  const prefix = value < 0 ? '-' : sign && value > 0 ? '+' : ''

  if (compact) {
    if (abs >= 1e7) return `${prefix}₹${(abs / 1e7).toFixed(2)}Cr`
    if (abs >= 1e5) return `${prefix}₹${(abs / 1e5).toFixed(2)}L`
    if (abs >= 1e3) return `${prefix}₹${(abs / 1e3).toFixed(1)}K`
  }

  return `${prefix}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function formatPct(value, opts = {}) {
  if (value === null || value === undefined || isNaN(value)) return '—'
  const { sign = true } = opts
  const prefix = value > 0 && sign ? '+' : ''
  return `${prefix}${value.toFixed(2)}%`
}

export function pnlColor(value) {
  if (!value && value !== 0) return 'text-slate-400'
  return value >= 0 ? 'text-green-400' : 'text-red-400'
}

export function formatDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function isMarketOpen() {
  const now = new Date()
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const day = ist.getDay()
  if (day === 0 || day === 6) return false
  const h = ist.getHours()
  const m = ist.getMinutes()
  const mins = h * 60 + m
  return mins >= 555 && mins <= 930  // 9:15 AM – 3:30 PM
}

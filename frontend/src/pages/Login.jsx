import { useState } from 'react'
import { Zap, ExternalLink, Loader2 } from 'lucide-react'
import { useLogin, useAuthStatus } from '../hooks/usePortfolio'

export default function Login() {
  const { mutate: login, isPending, data: loginData, error } = useLogin()
  const [loginUrl, setLoginUrl] = useState(null)

  const handleLogin = async () => {
    login(undefined, {
      onSuccess: (data) => setLoginUrl(data.login_url),
    })
  }

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gold-500 flex items-center justify-center mx-auto mb-4">
            <Zap size={24} className="text-navy-950" fill="currentColor" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Kite Portfolio Dashboard</h1>
          <p className="text-slate-400 mt-2 text-sm">Connect your Zerodha account to get started</p>
        </div>

        <div className="card space-y-5">
          {!loginUrl ? (
            <>
              <div className="text-xs text-slate-400 space-y-1.5">
                <p className="font-medium text-slate-300">One-time authentication required</p>
                <p>Click below to generate your Kite login URL. You'll be redirected to Zerodha to authenticate, then the dashboard will load automatically.</p>
              </div>
              <button
                onClick={handleLogin}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-navy-950 font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-60"
              >
                {isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Connecting to Kite MCP…</>
                ) : (
                  <><Zap size={16} fill="currentColor" /> Login with Zerodha Kite</>
                )}
              </button>
              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  {error?.response?.data?.detail || 'Failed to connect to Kite MCP. Is the backend running?'}
                </p>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-slate-400 space-y-1.5">
                <p className="font-medium text-amber-400">Action required</p>
                <p>Click the link below to authenticate with Zerodha. Return here after logging in — the dashboard will detect the session automatically.</p>
              </div>
              <a
                href={loginUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-gold-500 transition-colors group"
              >
                <span className="text-xs text-gold-400 font-medium truncate">{loginUrl}</span>
                <ExternalLink size={13} className="shrink-0 text-slate-500 group-hover:text-gold-400 transition-colors" />
              </a>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 size={12} className="animate-spin text-gold-500" />
                Waiting for authentication…
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Data fetched directly from Zerodha Kite MCP · Read-only access
        </p>
      </div>
    </div>
  )
}

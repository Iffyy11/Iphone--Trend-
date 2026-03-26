import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Lock, Mail } from 'lucide-react'
import { SHOP } from '../brand'
import { LogoMark } from '../components/LogoMark'
import { ThemeToggle } from '../components/ThemeToggle'
import { apiJson, hasApiBase } from '../lib/api'
import type { UserRole } from '../types'
import { normalizeEmail } from '../lib/hash'
import { usePosStore } from '../store/posStore'

export function Login() {
  const navigate = useNavigate()
  const session = usePosStore((s) => s.session)
  const adminAccount = usePosStore((s) => s.adminAccount)
  const initAdminAccount = usePosStore((s) => s.initAdminAccount)
  const adminLogin = usePosStore((s) => s.adminLogin)
  const cashierLogin = usePosStore((s) => s.cashierLogin)

  const [hydrated, setHydrated] = useState(false)
  const [role, setRole] = useState<UserRole>('cashier')
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [setupEmail, setSetupEmail] = useState('')
  const [setupPassword, setSetupPassword] = useState('')
  const [setupPassword2, setSetupPassword2] = useState('')
  const [apiHasAdmin, setApiHasAdmin] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const finish = () => setHydrated(true)
    const unsub = usePosStore.persist.onFinishHydration(finish)
    if (usePosStore.persist.hasHydrated()) finish()
    return unsub
  }, [])

  useEffect(() => {
    if (!session.role) return
    navigate(session.role === 'admin' ? '/admin' : '/cashier', { replace: true })
  }, [session.role, navigate])

  useEffect(() => {
    if (!hydrated || !hasApiBase()) return
    let alive = true
    apiJson<{ ok: boolean; hasAdmin?: boolean }>('/api/admin/status')
      .then((r) => {
        if (alive) setApiHasAdmin(Boolean(r.hasAdmin))
      })
      .catch(() => {
        if (alive) setApiHasAdmin(true)
      })
    return () => {
      alive = false
    }
  }, [hydrated])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (role === 'cashier') {
        if (!pin.trim()) {
          setError('Enter your PIN.')
          return
        }
        const ok = await cashierLogin(pin)
        if (!ok) {
          setError('Invalid PIN, or no cashier accounts yet. Ask an administrator.')
          return
        }
        navigate('/cashier', { replace: true })
        return
      }
      if (!email.trim() || !password) {
        setError('Enter email and password.')
        return
      }
      const ok = await adminLogin(email, password)
      if (!ok) {
        setError('Wrong email or password.')
        return
      }
      navigate('/admin', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  async function onSetup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const eNorm = normalizeEmail(setupEmail)
    if (!eNorm || !setupPassword) {
      setError('Enter email and password.')
      return
    }
    if (setupPassword !== setupPassword2) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const created = await initAdminAccount(eNorm, setupPassword)
      if (!created) {
        setError('Could not create account.')
        return
      }
      const ok = await adminLogin(eNorm, setupPassword)
      if (!ok) {
        setError('Account created but sign-in failed. Try logging in.')
        return
      }
      navigate('/admin', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] min-h-dvh items-center justify-center bg-slate-50 dark:bg-[#0f172a]">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </div>
    )
  }

  if (hasApiBase() && apiHasAdmin === null) {
    return (
      <div className="flex min-h-[100dvh] min-h-dvh items-center justify-center bg-slate-50 dark:bg-[#0f172a]">
        <p className="text-sm text-slate-500 dark:text-slate-400">Checking account status…</p>
      </div>
    )
  }

  const shell = (card: ReactNode) => (
    <div className="relative flex min-h-[100dvh] min-h-dvh flex-col items-center justify-center overflow-x-hidden overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-brand-pink/[0.06] px-[max(1rem,env(safe-area-inset-left,0px))] py-12 pr-[max(1rem,env(safe-area-inset-right,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-[max(2.5rem,env(safe-area-inset-top,0px))] dark:from-[#0f172a] dark:via-[#0f172a] dark:to-[#0f172a]">
      <div className="absolute right-[max(1rem,env(safe-area-inset-right,0px))] top-[max(1rem,env(safe-area-inset-top,0px))] z-10">
        <ThemeToggle />
      </div>
      <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-brand-pink/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-brand-green/10 blur-3xl" />
      {card}
    </div>
  )

  const showSetup = hasApiBase() ? apiHasAdmin === false : !adminAccount

  if (showSetup) {
    return shell(
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-2xl shadow-slate-300/40 backdrop-blur-md ring-1 ring-white/60 sm:p-8 dark:border-slate-400/50 dark:bg-slate-300 dark:shadow-none dark:ring-slate-400/30">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex justify-center">
            <LogoMark size="lg" className="shadow-lg ring-4 ring-brand-pink/20" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-900">
            {SHOP.displayName}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-600">
            First time on this browser or device
          </p>
          {hasApiBase() ? (
            <p className="mt-3 text-left text-xs leading-relaxed text-slate-600 dark:text-slate-700">
              No administrator exists in your online database yet. Create the first admin account to
              continue.
            </p>
          ) : (
            <p className="mt-3 text-left text-xs leading-relaxed text-slate-600 dark:text-slate-700">
              Your admin login and sales data are stored only in this browser-not on a server. Create the
              administrator for <span className="font-medium">this</span> device (you can use the same email
              and password as on your computer if you want).
            </p>
          )}
        </div>

        <form onSubmit={onSetup} className="space-y-5">
          <div>
            <label
              htmlFor="setup-email"
              className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              <Mail className="h-3.5 w-3.5" />
              Admin email
            </label>
            <input
              id="setup-email"
              type="email"
              autoComplete="username"
              value={setupEmail}
              onChange={(e) => setSetupEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-slate-900 outline-none focus:border-brand-pink focus:bg-white focus:ring-2 focus:ring-brand-pink/20 dark:border-slate-300 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-400 dark:focus:bg-white"
            />
          </div>
          <div>
            <label
              htmlFor="setup-password"
              className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              <Lock className="h-3.5 w-3.5" />
              Password
            </label>
            <input
              id="setup-password"
              type="password"
              autoComplete="new-password"
              value={setupPassword}
              onChange={(e) => setSetupPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-slate-900 outline-none focus:border-brand-pink focus:bg-white focus:ring-2 focus:ring-brand-pink/20 dark:border-slate-300 dark:bg-white dark:text-slate-900 dark:focus:bg-white"
            />
          </div>
          <div>
            <label
              htmlFor="setup-password2"
              className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              <Lock className="h-3.5 w-3.5" />
              Confirm password
            </label>
            <input
              id="setup-password2"
              type="password"
              autoComplete="new-password"
              value={setupPassword2}
              onChange={(e) => setSetupPassword2(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-slate-900 outline-none focus:border-brand-pink focus:bg-white focus:ring-2 focus:ring-brand-pink/20 dark:border-slate-300 dark:bg-white dark:text-slate-900 dark:focus:bg-white"
            />
          </div>

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/25 transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? 'Please wait…' : 'Create admin & continue'}
          </button>
        </form>
      </div>,
    )
  }

  return shell(
    <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-2xl shadow-slate-300/40 backdrop-blur-md ring-1 ring-white/60 sm:p-8 dark:border-slate-400/50 dark:bg-slate-300 dark:shadow-none dark:ring-slate-400/30">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex justify-center">
            <LogoMark size="lg" className="shadow-lg ring-4 ring-brand-pink/20" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-900">
            {SHOP.displayName}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-600">Point of sale · Sign in</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              I am
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['cashier', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRole(r)
                    setError('')
                    setPin('')
                    setEmail('')
                    setPassword('')
                  }}
                  className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold capitalize transition ${
                    role === r
                      ? 'border-brand-pink bg-brand-pink/10 text-slate-900 shadow-sm dark:border-slate-900 dark:bg-slate-900 dark:text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-400 dark:bg-slate-200 dark:text-slate-700 dark:hover:border-slate-500'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {role === 'cashier' ? (
            <div>
              <label
                htmlFor="pin"
                className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                <KeyRound className="h-3.5 w-3.5" />
                PIN
              </label>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Your PIN"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-slate-900 outline-none focus:border-brand-pink focus:bg-white focus:ring-2 focus:ring-brand-pink/20 dark:border-slate-300 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-400 dark:focus:bg-white"
              />
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-slate-900 outline-none focus:border-brand-pink focus:bg-white focus:ring-2 focus:ring-brand-pink/20 dark:border-slate-300 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-400 dark:focus:bg-white"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-slate-900 outline-none focus:border-brand-pink focus:bg-white focus:ring-2 focus:ring-brand-pink/20 dark:border-slate-300 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-400 dark:focus:bg-white"
                />
              </div>
            </>
          )}

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/25 transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? 'Please wait…' : 'Continue'}
          </button>
        </form>
      </div>,
  )
}

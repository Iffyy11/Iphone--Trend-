import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Lock, Mail } from 'lucide-react'
import { SHOP } from '../brand'
import { InstallButton } from '../components/InstallButton'
import { LogoMark } from '../components/LogoMark'
import { ThemeToggle } from '../components/ThemeToggle'
import type { UserRole } from '../types'
import { usePosStore } from '../store/posStore'

export function Login() {
  const navigate = useNavigate()
  const session = usePosStore((s) => s.session)
  const adminLogin = usePosStore((s) => s.adminLogin)
  const cashierLogin = usePosStore((s) => s.cashierLogin)

  const [hydrated, setHydrated] = useState(false)
  const [role, setRole] = useState<UserRole>('cashier')
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
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
          setError('Invalid PIN, cashier not found, or server not reachable.')
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
        setError('Wrong email/password, admin not found, or server not reachable.')
        return
      }
      navigate('/admin', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <p className="text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />
        <span className="relative text-sm font-semibold tracking-tight text-blue-100">{SHOP.displayName}</span>
        <div className="relative max-w-md">
          <LogoMark
            size="xl"
            className="mb-10 rounded-3xl shadow-2xl shadow-blue-950/40 ring-4 ring-white/25 xl:h-64 xl:w-64"
          />
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Sell faster. Track every device.
          </h2>
          <p className="mt-4 text-base text-blue-100/90">
            Checkout, IMEI and warranty tracking, customer history and daily sales in one place.
          </p>
        </div>
        <p className="relative text-sm text-blue-100/70">{SHOP.gradeLine}</p>
      </section>

      {/* Form panel */}
      <section className="relative flex flex-col items-center justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-[max(4rem,env(safe-area-inset-top,0px))] sm:px-8">
        <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top,0px))]">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:text-left">
            <LogoMark size="xl" className="mx-auto mb-8 rounded-3xl shadow-pop ring-4 ring-accent/15 lg:hidden" />
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Welcome back</h1>
            <p className="mt-1.5 text-sm text-fg-muted">Sign in to {SHOP.displayName} point of sale.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div role="radiogroup" aria-label="Sign in as" className="grid grid-cols-2 rounded-xl border border-line bg-subtle p-1">
              {(['cashier', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={role === r}
                  onClick={() => {
                    setRole(r)
                    setError('')
                    setPin('')
                    setEmail('')
                    setPassword('')
                    setShowPin(false)
                    setShowPassword(false)
                  }}
                  className={`rounded-lg py-2 text-sm font-semibold capitalize transition ${
                    role === r ? 'bg-surface text-fg shadow-card' : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {role === 'cashier' ? (
              <div>
                <label htmlFor="pin" className="label flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />
                  PIN
                </label>
                <input
                  id="pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter your PIN"
                  className="input py-3 text-base tracking-widest"
                />
                <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-fg-muted">
                  <input
                    type="checkbox"
                    checked={showPin}
                    onChange={(e) => setShowPin(e.target.checked)}
                    className="accent-[rgb(var(--accent))]"
                  />
                  Show PIN
                </label>
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="email" className="label flex items-center gap-1.5">
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
                    className="input py-3"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="label flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    Password
                  </label>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input py-3"
                  />
                  <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-fg-muted">
                    <input
                      type="checkbox"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      className="accent-[rgb(var(--accent))]"
                    />
                    Show password
                  </label>
                </div>
              </>
            )}

            {error ? (
              <p className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2.5 text-sm text-danger">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={busy} className="btn-primary w-full py-3">
              {busy ? 'Please wait…' : 'Continue'}
            </button>
          </form>
          <InstallButton className="mt-6" />
        </div>
      </section>
    </div>
  )
}

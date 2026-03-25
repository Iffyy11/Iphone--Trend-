import { LogOut } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { SHOP } from '../brand'
import { LogoMark } from './LogoMark'
import { ThemeToggle } from './ThemeToggle'
import type { UserRole } from '../types'
import { usePosStore } from '../store/posStore'

const nav: { to: string; label: string; roles: UserRole[] }[] = [
  { to: '/cashier', label: 'Cashier', roles: ['cashier', 'admin'] },
  { to: '/admin', label: 'Admin', roles: ['admin'] },
]

const shellPad =
  'px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3'

export function AppShell() {
  const location = useLocation()
  const session = usePosStore((s) => s.session)
  const logout = usePosStore((s) => s.logout)
  const role = session.role

  return (
    <div className="flex min-h-dvh min-h-[100dvh] flex-col bg-gradient-to-b from-slate-50 to-white dark:from-[#0f172a] dark:to-[#0f172a]">
      <header className="no-print sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-lg dark:border-slate-400/40 dark:bg-slate-300/95">
        <div
          className={`mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4 ${shellPad}`}
        >
          <div className="flex items-center justify-between gap-2">
            <Link
              to={role === 'admin' ? '/admin' : '/cashier'}
              className="flex min-w-0 max-w-[calc(100%-8rem)] items-center gap-2 sm:max-w-none sm:gap-3"
            >
              <LogoMark size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-900">
                  {SHOP.displayName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-600">POS · KSh</p>
              </div>
            </Link>
            <div className="flex shrink-0 items-center gap-2 md:hidden">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-400 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          <nav className="flex w-full snap-x snap-mandatory gap-1 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] md:min-w-0 md:flex-1 md:justify-center md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden">
            {nav
              .filter((n) => role && n.roles.includes(role))
              .map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`inline-flex shrink-0 snap-start items-center justify-center rounded-xl px-4 py-3 text-sm font-medium transition ${
                    location.pathname.startsWith(n.to)
                      ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-700 dark:hover:bg-slate-200'
                  }`}
                >
                  {n.label}
                </Link>
              ))}
          </nav>

          <div className="hidden items-center gap-2 sm:gap-3 md:flex">
            <ThemeToggle />
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {role}
              </p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-900">
                {session.staffName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-400 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-[max(1rem,env(safe-area-inset-left,0px))] py-6 pr-[max(1rem,env(safe-area-inset-right,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
        <Outlet />
      </main>
    </div>
  )
}

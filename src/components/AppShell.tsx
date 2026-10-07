import { LogOut, Menu, ScanLine, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { SHOP } from '../brand'
import { ADMIN_SECTIONS, parseAdminTab } from '../navigation'
import { usePosStore } from '../store/posStore'
import { InstallButton } from './InstallButton'
import { LogoMark } from './LogoMark'
import { ThemeToggle } from './ThemeToggle'

function NavItem({
  to,
  active,
  icon: Icon,
  children,
}: {
  to: string
  active: boolean
  icon: typeof ScanLine
  children: string
}) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
        active
          ? 'bg-accent/10 text-accent'
          : 'text-fg-muted hover:bg-subtle hover:text-fg'
      }`}
    >
      <Icon
        className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-accent' : 'text-fg-subtle group-hover:text-fg-muted'}`}
        aria-hidden
      />
      {children}
    </Link>
  )
}

function SidebarContent() {
  const location = useLocation()
  const session = usePosStore((s) => s.session)
  const logout = usePosStore((s) => s.logout)
  const isAdmin = session.role === 'admin'
  const onAdmin = location.pathname.startsWith('/admin')
  const tab = parseAdminTab(new URLSearchParams(location.search).get('tab'))
  const initials = (session.staffName ?? '?').trim().slice(0, 2).toUpperCase()

  return (
    <div className="flex h-full flex-col">
      <Link
        to={isAdmin ? '/admin' : '/cashier'}
        className="flex items-center gap-3 px-5 pb-6 pt-6"
      >
        <LogoMark size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-fg">{SHOP.displayName}</p>
          <p className="text-xs text-fg-subtle">Point of sale · KSh</p>
        </div>
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3">
        <div className="space-y-1">
          <p className="eyebrow px-3 pb-1">Sell</p>
          <NavItem to="/cashier" active={location.pathname.startsWith('/cashier')} icon={ScanLine}>
            Point of sale
          </NavItem>
        </div>

        {isAdmin ? (
          <div className="space-y-1">
            <p className="eyebrow px-3 pb-1">Manage</p>
            {ADMIN_SECTIONS.map((s) => (
              <NavItem
                key={s.key}
                to={`/admin?tab=${s.key}`}
                active={onAdmin && tab === s.key}
                icon={s.icon}
              >
                {s.label}
              </NavItem>
            ))}
          </div>
        ) : null}
      </nav>

      <div className="space-y-3 border-t border-line p-3">
        <InstallButton />
        <ThemeToggle className="w-full" />
        <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{session.staffName}</p>
            <p className="text-xs capitalize text-fg-subtle">{session.role}</p>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="icon-btn"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function AppShell() {
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname, location.search])

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface/85 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] backdrop-blur-lg lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="icon-btn"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <LogoMark size="xs" />
        <p className="truncate text-sm font-semibold tracking-tight">{SHOP.displayName}</p>
      </header>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface pt-[env(safe-area-inset-top,0px)] shadow-pop">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="icon-btn absolute right-3 top-[max(1.25rem,env(safe-area-inset-top,0px))]"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      ) : null}

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-10 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

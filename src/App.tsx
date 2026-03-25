import type { ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { ThemeSync } from './components/ThemeSync'
import { AppShell } from './components/AppShell'
import { Admin } from './pages/Admin'
import { Cashier } from './pages/Cashier'
import { Login } from './pages/Login'
import { usePosStore } from './store/posStore'

function RequireAuth() {
  const role = usePosStore((s) => s.session.role)
  if (!role) return <Navigate to="/login" replace />
  return <Outlet />
}

function DefaultRedirect() {
  const role = usePosStore((s) => s.session.role)
  if (!role) return <Navigate to="/login" replace />
  return <Navigate to={role === 'admin' ? '/admin' : '/cashier'} replace />
}

function RoleGate({ allow, children }: { allow: 'cashier' | 'admin'; children: ReactNode }) {
  const role = usePosStore((s) => s.session.role)
  if (role !== allow && role !== 'admin') {
    return <Navigate to="/cashier" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <>
      <ThemeSync />
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route
            path="/cashier"
            element={
              <RoleGate allow="cashier">
                <Cashier />
              </RoleGate>
            }
          />
          <Route
            path="/admin"
            element={
              <RoleGate allow="admin">
                <Admin />
              </RoleGate>
            }
          />
        </Route>
      </Route>
      <Route path="/" element={<DefaultRedirect />} />
      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
    </>
  )
}

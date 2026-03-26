import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiJson, hasApiBase } from '../lib/api'
import { hashWithSalt, normalizeEmail, randomSalt } from '../lib/hash'
import { seedProducts } from '../data/seedProducts'
import { addMonths, toISODateEndOfDay } from '../lib/warranty'
import type {
  AdminAccount,
  CashierAccount,
  Order,
  OrderLine,
  PaymentMethod,
  Product,
  UserRole,
} from '../types'

function newOrderId(): string {
  const t = Date.now().toString(36).toUpperCase()
  const r = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `IT-${t}-${r}`
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export interface Session {
  role: UserRole | null
  staffName: string
}

interface PosState {
  products: Product[]
  orders: Order[]
  session: Session
  adminAccount: AdminAccount | null
  cashiers: CashierAccount[]

  initAdminAccount: (email: string, password: string) => Promise<boolean>
  adminLogin: (email: string, password: string) => Promise<boolean>
  cashierLogin: (pin: string) => Promise<boolean>
  fetchCashiers: () => Promise<void>
  logout: () => void

  addCashier: (name: string, pin: string) => Promise<void>
  removeCashier: (id: string) => Promise<void>
  updateCashierPin: (id: string, pin: string) => Promise<void>
  updateAdminCredentials: (
    currentPassword: string,
    opts: { newEmail?: string; newPassword?: string },
  ) => Promise<boolean>

  upsertProduct: (p: Product) => void
  setProductActive: (id: string, active: boolean) => void
  updateProductPrice: (id: string, price: number) => void
  addOrder: (input: {
    lines: OrderLine[]
    paymentMethod: PaymentMethod
    customerName: string
    customerId: string
    note?: string
  }) => Order | null
  voidOrder: (id: string) => void
}

const defaultSession: Session = { role: null, staffName: '' }

export const usePosStore = create<PosState>()(
  persist(
    (set, get) => ({
      products: seedProducts,
      orders: [],
      session: defaultSession,
      adminAccount: null,
      cashiers: [],

      async initAdminAccount(email, password) {
        const e = normalizeEmail(email)
        if (!e || !password) return false
        if (hasApiBase()) {
          try {
            const r = await apiJson<{ ok: boolean }>('/api/admin/bootstrap', {
              method: 'POST',
              body: JSON.stringify({ email: e, password }),
            })
            return Boolean(r.ok)
          } catch {
            return false
          }
        }
        const salt = randomSalt()
        const passwordHash = await hashWithSalt(password, salt)
        set({
          adminAccount: { email: e, salt, passwordHash },
        })
        return true
      },

      async adminLogin(email, password) {
        if (hasApiBase()) {
          try {
            const r = await apiJson<{ ok: boolean; staffName?: string }>('/api/admin/login', {
              method: 'POST',
              body: JSON.stringify({ email, password }),
            })
            if (!r.ok) return false
            set({ session: { role: 'admin', staffName: r.staffName || 'Admin' } })
            return true
          } catch {
            return false
          }
        }
        const acc = get().adminAccount
        if (!acc) return false
        const e = normalizeEmail(email)
        if (e !== acc.email) return false
        const h = await hashWithSalt(password, acc.salt)
        if (h !== acc.passwordHash) return false
        const display = acc.email.split('@')[0] || 'Admin'
        set({ session: { role: 'admin', staffName: display } })
        return true
      },

      async cashierLogin(pin) {
        if (hasApiBase()) {
          try {
            const r = await apiJson<{ ok: boolean; staffName?: string }>('/api/cashiers/login', {
              method: 'POST',
              body: JSON.stringify({ pin }),
            })
            if (!r.ok) return false
            set({ session: { role: 'cashier', staffName: r.staffName || 'Cashier' } })
            return true
          } catch {
            return false
          }
        }
        const list = get().cashiers ?? []
        if (list.length === 0) return false
        for (const c of list) {
          const h = await hashWithSalt(pin, c.pinSalt)
          if (h === c.pinHash) {
            set({ session: { role: 'cashier', staffName: c.name } })
            return true
          }
        }
        return false
      },

      async fetchCashiers() {
        if (!hasApiBase()) return
        try {
          const r = await apiJson<{ ok: boolean; cashiers?: CashierAccount[] }>('/api/cashiers')
          if (!r.ok) return
          set({ cashiers: r.cashiers ?? [] })
        } catch {
          // Keep existing local state when API is unreachable.
        }
      },

      logout() {
        set({ session: defaultSession })
      },

      async addCashier(name, pin) {
        const trimmed = name.trim()
        if (!trimmed || !pin) return
        if (hasApiBase()) {
          const r = await apiJson<{ ok: boolean; cashier?: CashierAccount }>('/api/cashiers', {
            method: 'POST',
            body: JSON.stringify({ name: trimmed, pin }),
          })
          if (!r.ok || !r.cashier) return
          set((s) => ({ cashiers: [...(s.cashiers ?? []), r.cashier as CashierAccount] }))
          return
        }
        const pinSalt = randomSalt()
        const pinHash = await hashWithSalt(pin, pinSalt)
        const id = newId()
        set((s) => ({
          cashiers: [
            ...(s.cashiers ?? []),
            { id, name: trimmed, pinSalt, pinHash, pinPlain: pin },
          ],
        }))
      },

      async removeCashier(id) {
        if (hasApiBase()) {
          try {
            await apiJson<{ ok: boolean }>(`/api/cashiers/${encodeURIComponent(id)}`, {
              method: 'DELETE',
            })
          } catch {
            // Proceed with local removal for immediate UI feedback.
          }
        }
        set((s) => ({
          cashiers: (s.cashiers ?? []).filter((c) => c.id !== id),
        }))
      },

      async updateCashierPin(id, pin) {
        if (!pin) return
        if (hasApiBase()) {
          const r = await apiJson<{ ok: boolean; cashier?: CashierAccount }>(
            `/api/cashiers/${encodeURIComponent(id)}/pin`,
            {
              method: 'PATCH',
              body: JSON.stringify({ pin }),
            },
          )
          if (!r.ok || !r.cashier) return
          set((s) => ({
            cashiers: (s.cashiers ?? []).map((c) => (c.id === id ? (r.cashier as CashierAccount) : c)),
          }))
          return
        }
        const pinSalt = randomSalt()
        const pinHash = await hashWithSalt(pin, pinSalt)
        set((s) => ({
          cashiers: (s.cashiers ?? []).map((c) =>
            c.id === id ? { ...c, pinSalt, pinHash, pinPlain: pin } : c,
          ),
        }))
      },

      async updateAdminCredentials(currentPassword, opts) {
        const admin = get().adminAccount
        if (!admin) return false
        const cur = await hashWithSalt(currentPassword, admin.salt)
        if (cur !== admin.passwordHash) return false
        let email = admin.email
        let salt = admin.salt
        let passwordHash = admin.passwordHash
        if (opts.newEmail) email = normalizeEmail(opts.newEmail)
        if (opts.newPassword) {
          salt = randomSalt()
          passwordHash = await hashWithSalt(opts.newPassword, salt)
        }
        set({ adminAccount: { email, salt, passwordHash } })
        return true
      },

      upsertProduct(p) {
        set((s) => {
          const i = s.products.findIndex((x) => x.id === p.id)
          if (i === -1) return { products: [...s.products, p] }
          const next = [...s.products]
          next[i] = p
          return { products: next }
        })
      },

      setProductActive(id, active) {
        set((s) => ({
          products: s.products.map((p) => (p.id === id ? { ...p, active } : p)),
        }))
      },

      updateProductPrice(id, price) {
        if (!Number.isFinite(price) || price < 0) return
        set((s) => ({
          products: s.products.map((p) =>
            p.id === id ? { ...p, price: Math.round(price) } : p,
          ),
        }))
      },

      addOrder({ lines, paymentMethod, customerName, customerId, note }) {
        const { session } = get()
        if (!session.role) return null
        const saleDate = new Date()
        const total = lines.reduce((a, l) => a + l.unitPrice * l.qty, 0)

        const linesWithExpiry: OrderLine[] = lines.map((l) => {
          const months = l.warrantyMonths ?? 0
          if (!months || months <= 0) {
            return { ...l, warrantyMonths: 0, warrantyExpiresAt: undefined }
          }
          const end = toISODateEndOfDay(addMonths(saleDate, months))
          return { ...l, warrantyMonths: months, warrantyExpiresAt: end }
        })

        const order: Order = {
          id: newOrderId(),
          createdAt: saleDate.toISOString(),
          lines: linesWithExpiry,
          total,
          role: session.role,
          staffLabel: session.staffName,
          paymentMethod,
          status: 'completed',
          customerName: customerName.trim(),
          customerId: customerId.trim(),
          note,
        }
        set((s) => ({ orders: [order, ...s.orders] }))
        return order
      },

      voidOrder(id) {
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === id ? { ...o, status: 'void' as const } : o,
          ),
        }))
      },
    }),
    {
      name: 'iphone-trend-pos',
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const acc = state.adminAccount as Record<string, unknown> | null | undefined
        if (acc && 'pinHash' in acc && !('passwordHash' in acc)) {
          usePosStore.setState({ adminAccount: null })
        }
      },
      partialize: (s) => ({
        products: s.products,
        orders: s.orders,
        adminAccount: s.adminAccount,
        cashiers: s.cashiers,
      }),
    },
  ),
)

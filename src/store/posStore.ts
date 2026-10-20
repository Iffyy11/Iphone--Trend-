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
  SupplierRecord,
  ExpenseRecord,
  BusinessInvoice,
  TradeInRecord,
  VatRecord,
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
  supplierRecords: SupplierRecord[]
  expenses: ExpenseRecord[]
  invoices: BusinessInvoice[]
  tradeIns: TradeInRecord[]
  vatRecords: VatRecord[]
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
  updateProductCostPrice: (id: string, costPrice: number | undefined) => void
  addSupplierRecord: (input: Omit<SupplierRecord, 'id' | 'unitsSold' | 'settledAmount'>) => void
  updateSupplierUnitsSold: (id: string, unitsSold: number) => void
  addSupplierSettlement: (id: string, amount: number) => void
  addExpense: (input: Omit<ExpenseRecord, 'id'>) => void
  addInvoice: (input: Omit<BusinessInvoice, 'id' | 'paidAmount'>) => void
  addInvoicePayment: (id: string, amount: number) => void
  addTradeIn: (input: Omit<TradeInRecord, 'id'>) => void
  addVatRecord: (input: Omit<VatRecord, 'id'>) => void
  addOrder: (input: {
    lines: OrderLine[]
    paymentMethod: PaymentMethod
    customerName: string
    customerId: string
    note?: string
    /** KSh off the subtotal; clamped to [0, subtotal]. */
    discount?: number
    tradeIn?: Omit<TradeInRecord, 'id' | 'receivedAt' | 'saleReference'>
  }) => Order | null
  voidOrder: (id: string) => void
}

const defaultSession: Session = { role: null, staffName: '' }

export const usePosStore = create<PosState>()(
  persist(
    (set, get) => ({
      products: seedProducts,
      orders: [],
      supplierRecords: [],
      expenses: [],
      invoices: [],
      tradeIns: [],
      vatRecords: [],
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

      updateProductCostPrice(id, costPrice) {
        if (costPrice !== undefined && (!Number.isFinite(costPrice) || costPrice < 0)) return
        set((s) => ({
          products: s.products.map((p) =>
            p.id === id ? { ...p, costPrice } : p,
          ),
        }))
      },

      addSupplierRecord(input) {
        if (
          !input.supplier.trim() ||
          !input.product.trim() ||
          !Number.isInteger(input.quantity) ||
          input.quantity < 1 ||
          !Number.isFinite(input.unitCost) ||
          input.unitCost < 0
        ) return
        set((s) => ({
          supplierRecords: [{ ...input, id: newId(), unitsSold: 0, settledAmount: 0 }, ...s.supplierRecords],
        }))
      },

      updateSupplierUnitsSold(id, unitsSold) {
        if (!Number.isInteger(unitsSold) || unitsSold < 0) return
        set((s) => ({
          supplierRecords: s.supplierRecords.map((r) => {
            if (r.id !== id || r.kind !== 'consignment' || unitsSold > r.quantity) return r
            const due = unitsSold * r.unitCost
            return due < r.settledAmount ? r : { ...r, unitsSold }
          }),
        }))
      },

      addSupplierSettlement(id, amount) {
        if (!Number.isFinite(amount) || amount <= 0) return
        set((s) => ({
          supplierRecords: s.supplierRecords.map((r) => {
            if (r.id !== id) return r
            const obligation = (r.kind === 'credit' ? r.quantity : r.unitsSold) * r.unitCost
            if (r.settledAmount + amount > obligation) return r
            return { ...r, settledAmount: r.settledAmount + amount }
          }),
        }))
      },

      addExpense(input) {
        if (
          !input.category.trim() ||
          !input.description.trim() ||
          !Number.isFinite(input.amount) ||
          input.amount <= 0 ||
          !Number.isFinite(input.vatRate) ||
          input.vatRate < 0 ||
          input.vatRate > 100
        ) return
        set((s) => ({ expenses: [{ ...input, id: newId() }, ...s.expenses] }))
      },

      addInvoice(input) {
        if (
          !input.number.trim() ||
          !input.customer.trim() ||
          !Number.isFinite(input.amount) ||
          input.amount <= 0
        ) return
        set((s) => ({ invoices: [{ ...input, id: newId(), paidAmount: 0 }, ...s.invoices] }))
      },

      addInvoicePayment(id, amount) {
        if (!Number.isFinite(amount) || amount <= 0) return
        set((s) => ({
          invoices: s.invoices.map((i) =>
            i.id === id && i.paidAmount + amount <= i.amount
              ? { ...i, paidAmount: i.paidAmount + amount }
              : i,
          ),
        }))
      },

      addTradeIn(input) {
        if (
          !input.customer.trim() ||
          !input.device.trim() ||
          !input.condition.trim() ||
          !Number.isFinite(input.value) ||
          input.value <= 0
        ) return
        set((s) => ({ tradeIns: [{ ...input, id: newId() }, ...s.tradeIns] }))
      },

      addVatRecord(input) {
        if (
          !input.reference.trim() ||
          !Number.isFinite(input.taxableAmount) ||
          input.taxableAmount < 0 ||
          !Number.isFinite(input.vatRate) ||
          input.vatRate < 0 ||
          input.vatRate > 100
        ) return
        set((s) => ({ vatRecords: [{ ...input, id: newId() }, ...s.vatRecords] }))
      },

      addOrder({ lines, paymentMethod, customerName, customerId, note, discount, tradeIn }) {
        const { session } = get()
        if (!session.role) return null
        const saleDate = new Date()
        const subtotal = lines.reduce((a, l) => a + l.unitPrice * l.qty, 0)
        const off = Math.min(subtotal, Math.max(0, Math.round(discount ?? 0)))
        const rawTradeInValue = tradeIn?.value ?? 0
        if (
          !Number.isFinite(rawTradeInValue) ||
          rawTradeInValue < 0 ||
          (tradeIn !== undefined && rawTradeInValue <= 0) ||
          (tradeIn !== undefined && (!tradeIn.customer.trim() || !tradeIn.device.trim() || !tradeIn.condition.trim()))
        ) return null
        const tradeInValue = Math.round(rawTradeInValue)
        if (tradeInValue > subtotal - off) return null
        const total = subtotal - off - tradeInValue
        const orderId = newOrderId()

        const linesWithExpiry: OrderLine[] = lines.map((l) => {
          const months = l.warrantyMonths ?? 0
          if (!months || months <= 0) {
            return { ...l, warrantyMonths: 0, warrantyExpiresAt: undefined }
          }
          const end = toISODateEndOfDay(addMonths(saleDate, months))
          return { ...l, warrantyMonths: months, warrantyExpiresAt: end }
        })

        const order: Order = {
          id: orderId,
          createdAt: saleDate.toISOString(),
          lines: linesWithExpiry,
          ...(off > 0 || tradeInValue > 0 ? { subtotal, ...(off > 0 ? { discount: off } : {}) } : {}),
          ...(tradeInValue > 0 ? { tradeInValue, tradeInDevice: tradeIn?.device.trim() } : {}),
          total,
          role: session.role,
          staffLabel: session.staffName,
          paymentMethod,
          status: 'completed',
          customerName: customerName.trim(),
          customerId: customerId.trim(),
          note,
        }
        set((s) => ({
          orders: [order, ...s.orders],
          ...(tradeInValue > 0 && tradeIn
            ? {
                tradeIns: [
                  {
                    ...tradeIn,
                    customer: tradeIn.customer.trim(),
                    device: tradeIn.device.trim(),
                    imei: tradeIn.imei?.trim() || undefined,
                    id: newId(),
                    receivedAt: saleDate.toISOString(),
                    saleReference: orderId,
                  },
                  ...s.tradeIns,
                ],
              }
            : {}),
        }))
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
        supplierRecords: s.supplierRecords,
        expenses: s.expenses,
        invoices: s.invoices,
        tradeIns: s.tradeIns,
        vatRecords: s.vatRecords,
        adminAccount: s.adminAccount,
        cashiers: s.cashiers,
      }),
    },
  ),
)

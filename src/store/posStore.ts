import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiJson, hasApiBase, setApiToken } from '../lib/api'
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
  SupplierPayment,
  ExpenseRecord,
  BusinessInvoice,
  TradeInRecord,
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

let persistenceError: string | null = null
const persistenceErrorListeners = new Set<() => void>()

function setPersistenceError(error: unknown) {
  persistenceError = error instanceof Error ? error.message : String(error)
  persistenceErrorListeners.forEach((listener) => listener())
}

export function getPersistenceError() {
  return persistenceError
}

export function subscribePersistenceError(listener: () => void) {
  persistenceErrorListeners.add(listener)
  return () => persistenceErrorListeners.delete(listener)
}

function clearPersistenceError() {
  persistenceError = null
  persistenceErrorListeners.forEach((listener) => listener())
}

interface PosState {
  products: Product[]
  orders: Order[]
  suppliers: string[]
  supplierRecords: SupplierRecord[]
  supplierPayments: SupplierPayment[]
  expenses: ExpenseRecord[]
  invoices: BusinessInvoice[]
  tradeIns: TradeInRecord[]
  session: Session
  adminAccount: AdminAccount | null
  cashiers: CashierAccount[]
  sharedSyncError: string

  initAdminAccount: (email: string, password: string) => Promise<boolean>
  adminLogin: (email: string, password: string) => Promise<boolean>
  cashierLogin: (pin: string) => Promise<boolean>
  fetchCashiers: () => Promise<void>
  refreshSharedData: (polling?: boolean) => Promise<boolean>
  resetSharedData: () => Promise<boolean>
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
  addSupplier: (name: string) => void
  addSupplierRecord: (input: Omit<SupplierRecord, 'id' | 'unitsSold' | 'settledAmount'>) => void
  addSupplierSettlement: (supplier: string, amount: number) => void
  addExpense: (input: Omit<ExpenseRecord, 'id'>) => void
  addInvoice: (input: Omit<BusinessInvoice, 'id' | 'paidAmount'>) => void
  addInvoicePayment: (id: string, amount: number) => void
  addTradeIn: (input: Omit<TradeInRecord, 'id'>) => void
  addOrder: (input: {
    lines: OrderLine[]
    paymentMethod: PaymentMethod
    customerName: string
    customerId: string
    customerPhone?: string
    customerEmail?: string
    note?: string
    /** KSh off the subtotal; clamped to [0, subtotal]. */
    discount?: number
    vat?: { rate: number; inclusive: boolean }
    tradeIn?: Omit<TradeInRecord, 'id' | 'receivedAt' | 'saleReference'>
  }) => Order | null
  voidOrder: (id: string) => void
}

type SharedPosData = Pick<
  PosState,
  'products' | 'orders' | 'suppliers' | 'supplierRecords' |
  'supplierPayments' | 'expenses' | 'invoices' | 'tradeIns'
>

type SharedStateResponse = {
  ok: boolean
  initialized: boolean
  epoch: number
  revision: number
  data: SharedPosData | null
  conflict?: boolean
}

const defaultSession: Session = { role: null, staffName: '' }
let sharedEpoch = 0
let sharedRevision = 0
let applyingSharedData = false
let sharedSyncQueue = Promise.resolve()

function sharedDataFrom(state: PosState): SharedPosData {
  return {
    products: state.products,
    orders: state.orders,
    suppliers: state.suppliers,
    supplierRecords: state.supplierRecords,
    supplierPayments: state.supplierPayments,
    expenses: state.expenses,
    invoices: state.invoices,
    tradeIns: state.tradeIns,
  }
}

function cleanSharedData(products: Product[]): SharedPosData {
  return {
    products,
    orders: [],
    suppliers: [],
    supplierRecords: [],
    supplierPayments: [],
    expenses: [],
    invoices: [],
    tradeIns: [],
  }
}

function mergeSharedData(local: SharedPosData, remote: SharedPosData): SharedPosData {
  const mergeById = <T extends { id: string }>(left: T[], right: T[]) => {
    const records = new Map(left.map((item) => [item.id, item]))
    for (const item of right) records.set(item.id, item)
    return [...records.values()]
  }
  return {
    products: mergeById(local.products, remote.products),
    orders: mergeById(local.orders, remote.orders).map((order) => {
      const saved = local.orders.find((item) => item.id === order.id)
      return saved?.status === 'void' ? { ...order, status: 'void' } : order
    }),
    suppliers: [...new Set([...local.suppliers, ...remote.suppliers])],
    supplierRecords: mergeById(local.supplierRecords, remote.supplierRecords).map((record) => {
      const localRecord = local.supplierRecords.find((item) => item.id === record.id)
      return localRecord
        ? { ...record, settledAmount: Math.max(localRecord.settledAmount, record.settledAmount) }
        : record
    }),
    supplierPayments: mergeById(local.supplierPayments, remote.supplierPayments),
    expenses: mergeById(local.expenses, remote.expenses),
    invoices: mergeById(local.invoices, remote.invoices).map((invoice) => {
      const localInvoice = local.invoices.find((item) => item.id === invoice.id)
      return localInvoice
        ? { ...invoice, paidAmount: Math.max(localInvoice.paidAmount, invoice.paidAmount) }
        : invoice
    }),
    tradeIns: mergeById(local.tradeIns, remote.tradeIns),
  }
}

export const usePosStore = create<PosState>()(
  persist(
    (set, get) => ({
      products: seedProducts,
      orders: [],
      suppliers: [],
      supplierRecords: [],
      supplierPayments: [],
      expenses: [],
      invoices: [],
      tradeIns: [],
      session: defaultSession,
      adminAccount: null,
      cashiers: [],
      sharedSyncError: '',

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
            const r = await apiJson<{ ok: boolean; staffName?: string; token?: string }>('/api/admin/login', {
              method: 'POST',
              body: JSON.stringify({ email, password }),
            })
            if (!r.ok || !r.token) return false
            setApiToken(r.token)
            if (!await get().refreshSharedData()) {
              setApiToken(null)
              return false
            }
            set({ session: { role: 'admin', staffName: r.staffName || 'Admin' } })
            return true
          } catch {
            setApiToken(null)
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
            const r = await apiJson<{ ok: boolean; staffName?: string; token?: string }>('/api/cashiers/login', {
              method: 'POST',
              body: JSON.stringify({ pin }),
            })
            if (!r.ok || !r.token) return false
            setApiToken(r.token)
            if (!await get().refreshSharedData()) {
              setApiToken(null)
              return false
            }
            set({ session: { role: 'cashier', staffName: r.staffName || 'Cashier' } })
            return true
          } catch {
            setApiToken(null)
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

      async refreshSharedData(polling = false) {
        if (!hasApiBase()) return true
        try {
          if (polling) {
            if (get().sharedSyncError) return false
            await sharedSyncQueue
          }
          const localAtStart = sharedDataFrom(get())
          let remote = await apiJson<SharedStateResponse>('/api/pos/state')
          if (!remote.initialized) {
            if (polling) return false
            const response = await apiJson<SharedStateResponse>('/api/pos/state', {
              method: 'PUT',
              body: JSON.stringify({
                initialize: true,
                epoch: 0,
                revision: 0,
                data: cleanSharedData(get().products),
              }),
            })
            remote = response.conflict
              ? await apiJson<SharedStateResponse>('/api/pos/state')
              : response
          }
          if (!remote.data) throw new Error('Shared POS data was not returned by the server.')
          if (polling) {
            const localNow = sharedDataFrom(get())
            const changedDuringRequest = sharedDataKeys.some((key) => localNow[key] !== localAtStart[key])
            if (changedDuringRequest) return true
            if (remote.epoch === sharedEpoch && remote.revision === sharedRevision) return true
          }
          sharedEpoch = remote.epoch
          sharedRevision = remote.revision
          applyingSharedData = true
          set({ ...remote.data, sharedSyncError: '' })
          applyingSharedData = false
          return true
        } catch (error) {
          applyingSharedData = false
          set({ sharedSyncError: error instanceof Error ? error.message : String(error) })
          return false
        }
      },

      async resetSharedData() {
        if (!hasApiBase() || get().session.role !== 'admin') {
          set({ sharedSyncError: 'Sign in as an administrator on the connected Render service to reset shared records.' })
          return false
        }
        try {
          await sharedSyncQueue
          const response = await apiJson<SharedStateResponse>('/api/pos/reset', {
            method: 'POST',
            body: JSON.stringify({ epoch: sharedEpoch, revision: sharedRevision }),
          })
          if (!response.data) throw new Error('The server did not return the reset POS data.')
          if (response.conflict) {
            sharedEpoch = response.epoch
            sharedRevision = response.revision
            applyingSharedData = true
            set({ ...response.data })
            applyingSharedData = false
            throw new Error('Shared data changed before the reset. Review the latest records and try again.')
          }
          sharedEpoch = response.epoch
          sharedRevision = response.revision
          applyingSharedData = true
          set({ ...response.data, sharedSyncError: '' })
          applyingSharedData = false
          return true
        } catch (error) {
          applyingSharedData = false
          set({ sharedSyncError: error instanceof Error ? error.message : String(error) })
          return false
        }
      },

      logout() {
        setApiToken(null)
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

      addSupplier(name) {
        const supplier = name.trim()
        if (!supplier) return
        set((s) => s.suppliers.some((item) => item.toLocaleLowerCase() === supplier.toLocaleLowerCase())
          ? s
          : { suppliers: [...s.suppliers, supplier] })
      },

      addSupplierRecord(input) {
        if (
          !input.supplier.trim() ||
          !input.product.trim() ||
          !Number.isInteger(input.quantity) ||
          input.quantity < 1 ||
          !Number.isFinite(input.unitCost) ||
          input.unitCost < 0 ||
          (input.deviceDetails !== undefined && input.deviceDetails.length !== input.quantity) ||
          input.deviceDetails?.some((device) =>
            device.batteryHealth !== undefined &&
            (!Number.isInteger(device.batteryHealth) || device.batteryHealth < 0 || device.batteryHealth > 100),
          )
        ) return
        set((s) => ({
          suppliers: s.suppliers.some((item) => item.toLocaleLowerCase() === input.supplier.trim().toLocaleLowerCase())
            ? s.suppliers
            : [...s.suppliers, input.supplier.trim()],
          supplierRecords: [{ ...input, id: newId(), unitsSold: 0, settledAmount: 0 }, ...s.supplierRecords],
        }))
      },

      addSupplierSettlement(supplier, amount) {
        const supplierName = supplier.trim()
        if (!supplierName || !Number.isInteger(amount) || amount <= 0) return
        set((s) => {
          const matchingRecords = s.supplierRecords
            .filter((record) => record.supplier.toLocaleLowerCase() === supplierName.toLocaleLowerCase())
            .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
          const totalOutstanding = matchingRecords.reduce((sum, record) => {
            const obligation = (record.kind === 'consignment' ? record.unitsSold : record.quantity) * record.unitCost
            return sum + Math.max(0, obligation - record.settledAmount)
          }, 0)
          if (amount > totalOutstanding) return s

          let remaining = amount
          const amountsByRecord = new Map<string, number>()
          for (const record of matchingRecords) {
            if (!remaining) break
            const obligation = (record.kind === 'consignment' ? record.unitsSold : record.quantity) * record.unitCost
            const allocation = Math.min(remaining, Math.max(0, obligation - record.settledAmount))
            amountsByRecord.set(record.id, allocation)
            remaining -= allocation
          }
          return {
            supplierRecords: s.supplierRecords.map((record) => ({
              ...record,
              settledAmount: record.settledAmount + (amountsByRecord.get(record.id) ?? 0),
            })),
            supplierPayments: [{
              id: newId(),
              supplier: supplierName,
              amount,
              paidAt: new Date().toISOString(),
            }, ...s.supplierPayments],
          }
        })
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

      addOrder({
        lines,
        paymentMethod,
        customerName,
        customerId,
        customerPhone,
        customerEmail,
        note,
        discount,
        vat,
        tradeIn,
      }) {
        const { session } = get()
        if (!session.role) return null
        const saleDate = new Date()
        const subtotal = lines.reduce((a, l) => a + l.unitPrice * l.qty, 0)
        const off = Math.min(subtotal, Math.max(0, Math.round(discount ?? 0)))
        const vatRate = vat?.rate ?? 0
        if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) return null
        const taxableAmount = Math.max(0, subtotal - off)
        const vatAmount = vatRate > 0
          ? Math.round((vat?.inclusive ?? false)
              ? taxableAmount * vatRate / (100 + vatRate)
              : taxableAmount * vatRate / 100)
          : 0
        const rawTradeInValue = tradeIn?.value ?? 0
        if (
          !Number.isFinite(rawTradeInValue) ||
          rawTradeInValue < 0 ||
          (tradeIn !== undefined && rawTradeInValue <= 0) ||
          (tradeIn !== undefined && (
            !tradeIn.customer.trim() ||
            !tradeIn.device.trim() ||
            !tradeIn.condition.trim() ||
            (tradeIn.batteryHealth !== undefined && (
              !Number.isInteger(tradeIn.batteryHealth) ||
              tradeIn.batteryHealth < 0 ||
              tradeIn.batteryHealth > 100
            ))
          ))
        ) return null
        const tradeInValue = Math.round(rawTradeInValue)
        if (tradeInValue > taxableAmount) return null
        const total = taxableAmount + (vat?.inclusive ? 0 : vatAmount) - tradeInValue
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
          ...(off > 0 || tradeInValue > 0 || vatRate > 0
            ? { subtotal, ...(off > 0 ? { discount: off } : {}) }
            : {}),
          ...(tradeInValue > 0 && tradeIn
            ? {
                tradeInValue,
                tradeInDevice: tradeIn.device.trim(),
                tradeInDetails: {
                  device: tradeIn.device.trim(),
                  imei: tradeIn.imei?.trim() || undefined,
                  imei2: tradeIn.imei2?.trim() || undefined,
                  serialNumber: tradeIn.serialNumber?.trim() || undefined,
                  color: tradeIn.color?.trim() || undefined,
                  storage: tradeIn.storage?.trim() || undefined,
                  batteryHealth: tradeIn.batteryHealth,
                  condition: tradeIn.condition.trim(),
                },
              }
            : {}),
          ...(vat
            ? { vatRate, vatAmount, vatInclusive: vat?.inclusive ?? false }
            : {}),
          total,
          role: session.role,
          staffLabel: session.staffName,
          paymentMethod,
          status: 'completed',
          customerName: customerName.trim(),
          customerId: customerId.trim(),
          customerPhone: customerPhone?.trim() || undefined,
          customerEmail: customerEmail?.trim() || undefined,
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
      version: 4,
      migrate: (persistedState, version) => {
        const state = persistedState as PosState
        if (version < 1 && Array.isArray(state.products)) {
          const updatedSeedProducts = seedProducts.filter((product) =>
            /^iPhone (?:16|15|14|13|12|11|X|XS)$/.test(product.category) ||
            /^sam-(?:s2[1-5]|fold6)/.test(product.id),
          )
          const updatesById = new Map(updatedSeedProducts.map((product) => [product.id, product]))
          const storedIds = new Set(state.products.map((product) => product.id))
          state.products = [
            ...state.products.map((product) => updatesById.get(product.id) ?? product),
            ...updatedSeedProducts.filter((product) => !storedIds.has(product.id)),
          ]
        }
        if (version < 2) {
          state.suppliers = [
            ...new Set([
              ...(state.suppliers ?? []),
              ...(state.supplierRecords ?? []).map((record) => record.supplier),
            ]),
          ]
        }
        if (version < 3) {
          state.supplierPayments = []
        }
        if (version < 4) {
          delete (state as PosState & { vatRecords?: unknown }).vatRecords
        }
        return state
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Unable to load saved POS data.', error)
          setPersistenceError(error)
          return
        }
        if (!state) {
          setPersistenceError(new Error('Saved POS data could not be loaded.'))
          return
        }
        clearPersistenceError()
        const acc = state.adminAccount as Record<string, unknown> | null | undefined
        if (acc && 'pinHash' in acc && !('passwordHash' in acc)) {
          usePosStore.setState({ adminAccount: null })
        }
        const products = state.products ?? seedProducts
        const productIds = new Set(products.map((product) => product.id))
        const missingIpads = seedProducts.filter(
          (product) => product.category.startsWith('iPad') && !productIds.has(product.id),
        )
        if (missingIpads.length > 0) {
          usePosStore.setState({ products: [...products, ...missingIpads] })
        }
      },
      partialize: (s) => ({
        products: s.products,
        orders: s.orders,
        suppliers: s.suppliers,
        supplierRecords: s.supplierRecords,
        supplierPayments: s.supplierPayments,
        expenses: s.expenses,
        invoices: s.invoices,
        tradeIns: s.tradeIns,
        adminAccount: s.adminAccount,
        cashiers: s.cashiers,
      }),
    },
  ),
)

const sharedDataKeys: (keyof SharedPosData)[] = [
  'products',
  'orders',
  'suppliers',
  'supplierRecords',
  'supplierPayments',
  'expenses',
  'invoices',
  'tradeIns',
]

usePosStore.subscribe((state, previousState) => {
  if (
    !hasApiBase() ||
    !state.session.role ||
    applyingSharedData ||
    sharedDataKeys.every((key) => state[key] === previousState[key])
  ) return

  const localData = sharedDataFrom(state)
  sharedSyncQueue = sharedSyncQueue.then(async () => {
    let response = await apiJson<SharedStateResponse>('/api/pos/state', {
      method: 'PUT',
      body: JSON.stringify({ epoch: sharedEpoch, revision: sharedRevision, data: localData }),
    })
    if (response.conflict) {
      if (!response.data) throw new Error('Shared POS data changed; reload the app and try again.')
      if (response.epoch !== sharedEpoch) {
        sharedEpoch = response.epoch
        sharedRevision = response.revision
        applyingSharedData = true
        usePosStore.setState({ ...response.data, sharedSyncError: '' })
        applyingSharedData = false
        return
      }
      const merged = mergeSharedData(localData, response.data)
      response = await apiJson<SharedStateResponse>('/api/pos/state', {
        method: 'PUT',
        body: JSON.stringify({
          epoch: response.epoch,
          revision: response.revision,
          data: merged,
        }),
      })
      if (response.conflict || !response.data) {
        throw new Error('Shared POS data changed again. Reload the app before continuing.')
      }
    }
    sharedEpoch = response.epoch
    sharedRevision = response.revision
    usePosStore.setState({ sharedSyncError: '' })
  }).catch((error: unknown) => {
    applyingSharedData = false
    usePosStore.setState({
      sharedSyncError: error instanceof Error ? error.message : String(error),
    })
  })
})

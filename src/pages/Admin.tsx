import {
  BarChart3,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Download,
  KeyRound,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Users,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { SHOP } from '../brand'
import { summarizeCustomers } from '../lib/customers'
import {
  isOrderInRange,
  rangeCustom,
  rangeLastWeek,
  rangeThisMonth,
  rangeThisYear,
  startOfDay,
} from '../lib/dateRange'
import { formatKES, orderRefFromId } from '../lib/format'
import { randomPin4 } from '../lib/pin'
import {
  buildWarrantyRecords,
  downloadTextFile,
  exportWarrantiesCsv,
  warrantyRowMeta,
} from '../lib/warrantyRecords'
import type { Order, Product } from '../types'
import { usePosStore } from '../store/posStore'

type Tab = 'overview' | 'orders' | 'customers' | 'warranties' | 'staff' | 'products'

type SalesPeriod = 'week' | 'month' | 'year' | 'custom'

function newProductId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function formatSalesRangeLabel(start: Date, end: Date) {
  const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const y: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  return `${start.toLocaleDateString('en-KE', o)} – ${end.toLocaleDateString('en-KE', y)}`
}

export function Admin() {
  const orders = usePosStore((s) => s.orders)
  const products = usePosStore((s) => s.products)
  const cashiers = usePosStore((s) => s.cashiers ?? [])
  const adminAccount = usePosStore((s) => s.adminAccount)
  const voidOrder = usePosStore((s) => s.voidOrder)
  const updateProductPrice = usePosStore((s) => s.updateProductPrice)
  const setProductActive = usePosStore((s) => s.setProductActive)
  const upsertProduct = usePosStore((s) => s.upsertProduct)
  const addCashier = usePosStore((s) => s.addCashier)
  const removeCashier = usePosStore((s) => s.removeCashier)
  const updateCashierPin = usePosStore((s) => s.updateCashierPin)
  const updateAdminCredentials = usePosStore((s) => s.updateAdminCredentials)

  const [tab, setTab] = useState<Tab>('overview')
  const [newCashierName, setNewCashierName] = useState('')
  const [newCashierPin, setNewCashierPin] = useState('')
  const [newCashierPin2, setNewCashierPin2] = useState('')
  const [staffMsg, setStaffMsg] = useState('')
  const [editPinId, setEditPinId] = useState<string | null>(null)
  const [editPin, setEditPin] = useState('')
  const [editPin2, setEditPin2] = useState('')
  const [adminCur, setAdminCur] = useState('')
  const [adminNewEmail, setAdminNewEmail] = useState('')
  const [adminNewPw, setAdminNewPw] = useState('')
  const [adminNewPw2, setAdminNewPw2] = useState('')
  const [adminAccountMsg, setAdminAccountMsg] = useState('')
  const [orderQuery, setOrderQuery] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [warrantyQuery, setWarrantyQuery] = useState('')
  const [warrantyFilter, setWarrantyFilter] = useState<'all' | 'active' | 'expired'>('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [custOpen, setCustOpen] = useState<Record<string, boolean>>({})
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [newProductCategory, setNewProductCategory] = useState('')
  const [newProductPrice, setNewProductPrice] = useState('')
  const [newProductActive, setNewProductActive] = useState(true)
  const [addProductMsg, setAddProductMsg] = useState('')

  const today = useMemo(() => startOfDay(new Date()), [])

  const completedOrders = useMemo(
    () => orders.filter((o) => o.status === 'completed'),
    [orders],
  )

  const todayOrders = useMemo(
    () => completedOrders.filter((o) => new Date(o.createdAt) >= today),
    [completedOrders, today],
  )

  const todayTotal = todayOrders.reduce((a, o) => a + o.total, 0)

  const warrantyRows = useMemo(() => buildWarrantyRecords(orders), [orders])

  const activeWarrantyCount = useMemo(
    () => warrantyRows.filter((r) => warrantyRowMeta(r.expiresAt).status === 'active').length,
    [warrantyRows],
  )

  const customers = useMemo(() => summarizeCustomers(orders), [orders])

  const productCategories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort((a, b) => a.localeCompare(b)),
    [products],
  )

  const filteredOrders = useMemo(() => {
    const n = orderQuery.trim().toLowerCase()
    if (!n) return orders
    return orders.filter((o) => {
      const cust = `${o.customerName ?? ''} ${o.customerId ?? ''}`.toLowerCase()
      return (
        o.id.toLowerCase().includes(n) ||
        o.staffLabel.toLowerCase().includes(n) ||
        cust.includes(n) ||
        o.lines.some(
          (l) =>
            l.name.toLowerCase().includes(n) ||
            (l.imei ?? '').toLowerCase().includes(n) ||
            (l.serialNumber ?? '').toLowerCase().includes(n),
        )
      )
    })
  }, [orders, orderQuery])

  const filteredCustomers = useMemo(() => {
    const n = customerQuery.trim().toLowerCase()
    if (!n) return customers
    return customers.filter(
      (c) =>
        c.customerName.toLowerCase().includes(n) ||
        c.customerId.toLowerCase().includes(n),
    )
  }, [customers, customerQuery])

  const filteredWarranties = useMemo(() => {
    const n = warrantyQuery.trim().toLowerCase()
    let rows = warrantyRows
    if (n) {
      rows = rows.filter(
        (r) =>
          r.customerName.toLowerCase().includes(n) ||
          r.customerId.toLowerCase().includes(n) ||
          r.productName.toLowerCase().includes(n) ||
          r.orderRef.toLowerCase().includes(n) ||
          (r.imei ?? '').toLowerCase().includes(n) ||
          (r.serialNumber ?? '').toLowerCase().includes(n),
      )
    }
    if (warrantyFilter === 'all') return rows
    return rows.filter((r) => warrantyRowMeta(r.expiresAt).status === warrantyFilter)
  }, [warrantyRows, warrantyQuery, warrantyFilter])

  const salesRange = useMemo(() => {
    if (salesPeriod === 'week') return rangeLastWeek()
    if (salesPeriod === 'month') return rangeThisMonth()
    if (salesPeriod === 'year') return rangeThisYear()
    return rangeCustom(customFrom, customTo)
  }, [salesPeriod, customFrom, customTo])

  const customRangeInvalid =
    salesPeriod === 'custom' &&
    (!customFrom || !customTo || !rangeCustom(customFrom, customTo))

  const periodOrders = useMemo(() => {
    if (!salesRange) return []
    return completedOrders.filter((o) =>
      isOrderInRange(o.createdAt, salesRange.start, salesRange.end),
    )
  }, [completedOrders, salesRange])

  const periodTotal = useMemo(
    () => periodOrders.reduce((a, o) => a + o.total, 0),
    [periodOrders],
  )

  const topToday = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>()
    for (const o of todayOrders) {
      for (const l of o.lines) {
        const cur = map.get(l.productId) ?? {
          name: l.name,
          qty: 0,
          revenue: 0,
        }
        cur.qty += l.qty
        cur.revenue += l.unitPrice * l.qty
        map.set(l.productId, cur)
      }
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  }, [todayOrders])

  function toggleExpand(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }))
  }

  function onProductPriceChange(id: string, raw: string) {
    const cleaned = raw.replace(/,/g, '').trim()
    if (cleaned === '') return
    const n = Number(cleaned)
    if (Number.isFinite(n) && n >= 0) updateProductPrice(id, Math.round(n))
  }

  function onAddProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAddProductMsg('')
    const name = newProductName.trim()
    const category = newProductCategory.trim()
    if (!name || !category) {
      setAddProductMsg('Enter product name and category.')
      return
    }
    const price = Number(String(newProductPrice).replace(/,/g, ''))
    if (!Number.isFinite(price) || price < 0) {
      setAddProductMsg('Enter a valid price (KSh).')
      return
    }
    const next: Product = {
      id: newProductId(),
      name,
      category,
      price: Math.round(price),
      active: newProductActive,
    }
    upsertProduct(next)
    setNewProductName('')
    setNewProductCategory('')
    setNewProductPrice('')
    setNewProductActive(true)
    setAddProductOpen(false)
    setAddProductMsg('Product added.')
  }

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-900">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-sm ring-1 ring-slate-100 dark:border-slate-400/40 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-400/20">
        <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
          {(
            [
              ['overview', 'Overview', BarChart3],
              ['orders', 'Orders', ShoppingCart],
              ['customers', 'Customers', Users],
              ['warranties', 'Warranties', ShieldCheck],
              ['staff', 'Staff', KeyRound],
              ['products', 'Products', Package],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex shrink-0 snap-start items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition sm:flex-1 sm:justify-center lg:flex-none ${
                tab === key
                  ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-700 dark:hover:bg-slate-200'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:border-slate-400/40 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-400/20">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-900">
                  <CalendarRange className="h-4 w-4 text-brand-pink" />
                  Sales by period
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-600">
                  Completed orders only
                  {salesRange
                    ? ` · ${formatSalesRangeLabel(salesRange.start, salesRange.end)}`
                    : salesPeriod === 'custom'
                      ? ' · pick dates'
                      : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['week', 'Week'],
                    ['month', 'Month'],
                    ['year', 'Year'],
                    ['custom', 'Custom'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSalesPeriod(k)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      salesPeriod === k
                        ? 'bg-slate-900 text-white dark:bg-slate-900 dark:text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-200 dark:text-slate-700 dark:hover:bg-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {salesPeriod === 'custom' ? (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-700">
                    From
                  </label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-300 dark:bg-white dark:text-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-700">
                    To
                  </label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-300 dark:bg-white dark:text-slate-900"
                  />
                </div>
              </div>
            ) : null}
            {customRangeInvalid ? (
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
                Pick a valid date range (from before to).
              </p>
            ) : (
              <div className="mt-4 flex flex-wrap items-baseline gap-6 border-t border-slate-100 pt-4 dark:border-slate-400/60">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Revenue
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-900">
                    {formatKES(periodTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Orders
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-900">
                    {periodOrders.length}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:border-slate-400/40 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-400/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Today · sales
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatKES(todayTotal)}</p>
            <p className="mt-1 text-sm text-slate-500">
              {todayOrders.length} completed order{todayOrders.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:border-slate-400/40 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-400/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Active warranties
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">{activeWarrantyCount}</p>
            <p className="mt-1 text-sm text-slate-500">Devices under cover</p>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:border-slate-400/40 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-400/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Customers (tracked)
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{customers.length}</p>
            <p className="mt-1 text-sm text-slate-500">Unique profiles</p>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:border-slate-400/40 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-400/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Cashier PINs
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{cashiers.length}</p>
            <p className="mt-1 text-sm text-slate-500">Registered in Staff</p>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:border-slate-400/40 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-400/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              All orders
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{orders.length}</p>
            <p className="mt-1 text-sm text-slate-500">
              {orders.filter((o) => o.status === 'void').length} voided
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:border-slate-400/40 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-400/20 sm:col-span-2 xl:col-span-3 2xl:col-span-5">
            <p className="text-sm font-bold text-slate-900">Shop</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{SHOP.displayName}</p>
            <p className="mt-1 text-xs text-slate-500">{SHOP.gradeLine}</p>
            <p className="mt-2 text-xs text-slate-500">{SHOP.phone}</p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:border-slate-400/40 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-400/20 sm:col-span-2 xl:col-span-3 2xl:col-span-5">
            <p className="text-sm font-bold text-slate-900">Top sellers today</p>
            {topToday.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No sales recorded today yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {topToday.map((row, i) => (
                  <li key={i} className="flex items-center justify-between py-3 text-sm">
                    <span className="font-medium text-slate-800">{row.name}</span>
                    <span className="text-slate-500">
                      {row.qty} sold · {formatKES(row.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        </div>
      ) : null}

      {tab === 'orders' ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100 dark:border-slate-400/40 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-400/20">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-400/50 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                placeholder="Order, customer, ID, IMEI, serial, product…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-pink focus:bg-white focus:ring-2 focus:ring-brand-pink/20 dark:border-slate-300 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-400 dark:focus:bg-white"
              />
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-400/50">
            {filteredOrders.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">No orders match.</p>
            ) : (
              filteredOrders.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  open={!!expanded[o.id]}
                  onToggle={() => toggleExpand(o.id)}
                  onVoid={() => voidOrder(o.id)}
                />
              ))
            )}
          </div>
        </div>
      ) : null}

      {tab === 'customers' ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              placeholder="Search by name or ID…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-pink/15 dark:border-slate-300 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-400"
            />
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100 dark:border-slate-400/40 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-400/20">
            {filteredCustomers.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">No customers found.</p>
            ) : (
              filteredCustomers.map((c) => (
                <div key={c.key} className="border-b border-slate-100 last:border-0 dark:border-slate-400/50">
                  <button
                    type="button"
                    onClick={() => setCustOpen((x) => ({ ...x, [c.key]: !x[c.key] }))}
                    className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-200/70"
                  >
                    {custOpen[c.key] ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{c.customerName}</p>
                      <p className="text-xs text-slate-500">ID {c.customerId}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-bold text-slate-900">{formatKES(c.totalSpent)}</p>
                      <p className="text-xs text-slate-500">{c.orders.length} purchases</p>
                    </div>
                  </button>
                  {custOpen[c.key] ? (
                    <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-4 dark:border-slate-400/50 dark:bg-slate-200/50">
                      <p className="text-xs font-semibold uppercase text-slate-400">Purchase history</p>
                      <ul className="mt-3 space-y-3">
                        {c.orders
                          .slice()
                          .sort(
                            (a, b) =>
                              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                          )
                          .map((o) => (
                            <li
                              key={o.id}
                              className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-300"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-mono font-semibold text-slate-800">
                                  {orderRefFromId(o.id)}
                                </span>
                                <span className="font-bold text-slate-900">{formatKES(o.total)}</span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                {new Date(o.createdAt).toLocaleString('en-KE')} · {o.staffLabel} ·{' '}
                                <span className="capitalize">{o.paymentMethod}</span>
                              </p>
                              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                                {o.lines.map((l, i) => (
                                  <li key={i}>
                                    {l.qty}× {l.name}
                                    {l.imei ? ` · IMEI ${l.imei}` : ''}
                                    {l.serialNumber ? ` · S/N ${l.serialNumber}` : ''}
                                  </li>
                                ))}
                              </ul>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {tab === 'warranties' ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={warrantyQuery}
                onChange={(e) => setWarrantyQuery(e.target.value)}
                placeholder="Search customer, IMEI, serial, product…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-pink/15 dark:border-slate-300 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-400"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'active', 'expired'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setWarrantyFilter(f)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold capitalize ${
                    warrantyFilter === f
                      ? 'bg-slate-900 text-white dark:bg-slate-900 dark:text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-200 dark:text-slate-700 dark:hover:bg-slate-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                const csv = exportWarrantiesCsv(filteredWarranties)
                downloadTextFile(`warranties-${new Date().toISOString().slice(0, 10)}.csv`, csv)
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-400 dark:bg-white dark:hover:bg-slate-100"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100 dark:border-slate-400/40 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-400/20">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-200/90 dark:text-slate-700">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">IMEI / Serial</th>
                  <th className="px-4 py-3">Purchased</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Days left</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-400/50">
                {filteredWarranties.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      No warranty records match.
                    </td>
                  </tr>
                ) : (
                  filteredWarranties.map((r) => {
                    const { status, daysLeft } = warrantyRowMeta(r.expiresAt)
                    return (
                      <tr key={r.key} className="hover:bg-slate-50/80 dark:hover:bg-slate-200/60">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{r.customerName}</p>
                          <p className="text-xs text-slate-500">ID {r.customerId}</p>
                          <p className="font-mono text-[11px] text-slate-400">{r.orderRef}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{r.productName}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {r.imei ? <p>IMEI {r.imei}</p> : null}
                          {r.serialNumber ? <p>S/N {r.serialNumber}</p> : null}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">
                          {new Date(r.purchasedAt).toLocaleDateString('en-KE')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">
                          {new Date(r.expiresAt).toLocaleDateString('en-KE')}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {status === 'expired' ? '—' : daysLeft}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'staff' ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:border-slate-400/40 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-400/20">
            <h2 className="text-lg font-bold text-slate-900">Cashier PINs</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-600">
              Enter a name, then leave the field — a 4-digit PIN is filled automatically. You can tap
              New PIN to roll another. The PIN is shown below each cashier for your reference (stored
              on this device only).
            </p>

            <form
              className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={async (e) => {
                e.preventDefault()
                setStaffMsg('')
                if (!newCashierName.trim() || !newCashierPin) {
                  setStaffMsg('Enter name and PIN.')
                  return
                }
                if (newCashierPin !== newCashierPin2) {
                  setStaffMsg('PIN confirmation does not match.')
                  return
                }
                await addCashier(newCashierName, newCashierPin)
                setNewCashierName('')
                setNewCashierPin('')
                setNewCashierPin2('')
                setStaffMsg('Cashier saved.')
              }}
            >
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-700">
                  Display name
                </label>
                <input
                  value={newCashierName}
                  onChange={(e) => setNewCashierName(e.target.value)}
                  onBlur={() => {
                    if (newCashierName.trim()) {
                      const p = randomPin4()
                      setNewCashierPin(p)
                      setNewCashierPin2(p)
                    }
                  }}
                  placeholder="e.g. Mary"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-pink dark:border-slate-300 dark:bg-white dark:text-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-700">
                  PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={newCashierPin}
                  onChange={(e) => setNewCashierPin(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-pink dark:border-slate-300 dark:bg-white dark:text-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-700">
                  Confirm PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={newCashierPin2}
                  onChange={(e) => setNewCashierPin2(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-pink dark:border-slate-300 dark:bg-white dark:text-slate-900"
                />
              </div>
              <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-400 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  onClick={() => {
                    const p = randomPin4()
                    setNewCashierPin(p)
                    setNewCashierPin2(p)
                  }}
                >
                  New PIN
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-900"
                >
                  Add cashier
                </button>
              </div>
            </form>
            {staffMsg ? (
              <p className="mt-3 text-sm text-emerald-700">{staffMsg}</p>
            ) : null}

            <ul className="mt-8 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-400/50 dark:border-slate-400/60 dark:bg-white/40">
              {cashiers.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-slate-500">
                  No cashiers yet. Add one above.
                </li>
              ) : (
                cashiers.map((c) => (
                  <li key={c.id} className="px-4 py-4">
                    {editPinId === c.id ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900">{c.name}</p>
                        </div>
                        <input
                          type="password"
                          inputMode="numeric"
                          placeholder="New PIN"
                          value={editPin}
                          onChange={(e) => setEditPin(e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-300 dark:text-slate-900"
                        />
                        <input
                          type="password"
                          inputMode="numeric"
                          placeholder="Confirm"
                          value={editPin2}
                          onChange={(e) => setEditPin2(e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-300 dark:text-slate-900"
                        />
                        <button
                          type="button"
                          className="rounded-lg bg-brand-green px-3 py-2 text-sm font-semibold text-white"
                          onClick={async () => {
                            setStaffMsg('')
                            if (!editPin || editPin !== editPin2) {
                              setStaffMsg('PINs must match.')
                              return
                            }
                            await updateCashierPin(c.id, editPin)
                            setEditPinId(null)
                            setEditPin('')
                            setEditPin2('')
                            setStaffMsg('PIN updated.')
                          }}
                        >
                          Save PIN
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          onClick={() => {
                            setEditPinId(null)
                            setEditPin('')
                            setEditPin2('')
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-900">{c.name}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-600">
                            PIN reference
                          </p>
                          <p className="mt-0.5 font-mono text-lg font-semibold tracking-wider text-slate-900 dark:text-slate-900">
                            {c.pinPlain ?? '—'}
                          </p>
                          {!c.pinPlain ? (
                            <p className="mt-1 text-[11px] text-slate-400">
                              Change PIN once to save a reference here.
                            </p>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                            onClick={() => {
                              setEditPinId(c.id)
                              setEditPin('')
                              setEditPin2('')
                            }}
                          >
                            Change PIN
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                            aria-label="Remove"
                            onClick={() => {
                              if (confirm(`Remove cashier ${c.name}?`)) removeCashier(c.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-6 ring-1 ring-slate-100 dark:border-slate-400/40 dark:bg-slate-200/90 dark:ring-slate-400/20">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-900">Administrator account</h2>
            <p className="mt-1 text-sm text-slate-600">
              Signed in as <span className="font-medium">{adminAccount?.email}</span>
            </p>
            <form
              className="mt-6 max-w-xl space-y-3"
              onSubmit={async (e) => {
                e.preventDefault()
                setAdminAccountMsg('')
                if (!adminCur) {
                  setAdminAccountMsg('Enter your current password.')
                  return
                }
                if (adminNewPw && adminNewPw !== adminNewPw2) {
                  setAdminAccountMsg('New passwords do not match.')
                  return
                }
                const ok = await updateAdminCredentials(adminCur, {
                  newEmail: adminNewEmail.trim() || undefined,
                  newPassword: adminNewPw || undefined,
                })
                if (!ok) {
                  setAdminAccountMsg('Current password incorrect.')
                  return
                }
                setAdminCur('')
                setAdminNewEmail('')
                setAdminNewPw('')
                setAdminNewPw2('')
                setAdminAccountMsg('Account updated.')
              }}
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Current password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={adminCur}
                  onChange={(e) => setAdminCur(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-pink"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  New email (optional)
                </label>
                <input
                  type="email"
                  value={adminNewEmail}
                  onChange={(e) => setAdminNewEmail(e.target.value)}
                  placeholder="Leave blank to keep current"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-pink"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  New password (optional)
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={adminNewPw}
                  onChange={(e) => setAdminNewPw(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-pink"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Confirm new password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={adminNewPw2}
                  onChange={(e) => setAdminNewPw2(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-pink"
                />
              </div>
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Update admin account
              </button>
            </form>
            {adminAccountMsg ? (
              <p className="mt-3 text-sm text-emerald-700">{adminAccountMsg}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'products' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setAddProductMsg('')
                setAddProductOpen((o) => !o)
              }}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Add product
            </button>
          </div>

          {addProductOpen ? (
            <form
              onSubmit={onAddProduct}
              className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100 dark:border-slate-400/40 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-400/20"
            >
              <p className="text-sm font-bold text-slate-900">New product</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-700">
                    Name
                  </label>
                  <input
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="e.g. iPhone 15 128GB · Black"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-pink dark:border-slate-300 dark:text-slate-900"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-700">
                    Category
                  </label>
                  <input
                    value={newProductCategory}
                    onChange={(e) => setNewProductCategory(e.target.value)}
                    placeholder="e.g. iPhone 15"
                    list="admin-product-categories"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-pink dark:border-slate-300 dark:text-slate-900"
                    autoComplete="off"
                  />
                  <datalist id="admin-product-categories">
                    {productCategories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-700">
                    Price (KSh)
                  </label>
                  <input
                    value={newProductPrice}
                    onChange={(e) => setNewProductPrice(e.target.value)}
                    placeholder="0"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-brand-pink dark:border-slate-300 dark:text-slate-900"
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-800">
                    <input
                      type="checkbox"
                      checked={newProductActive}
                      onChange={(e) => setNewProductActive(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-pink focus:ring-brand-pink"
                    />
                    On shelf (active)
                  </label>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-brand-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-105"
                >
                  Save product
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddProductOpen(false)
                    setAddProductMsg('')
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-400 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
              {addProductMsg ? (
                <p className="mt-3 text-sm text-red-700 dark:text-red-900/90">{addProductMsg}</p>
              ) : null}
            </form>
          ) : null}

          {addProductMsg && !addProductOpen ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-800">{addProductMsg}</p>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100 dark:border-slate-400/40 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-400/20">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-200/90 dark:text-slate-700">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price (KSh)</th>
                  <th className="px-4 py-3">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-400/50">
                {products.map((p) => (
                  <tr
                    key={p.id}
                    className={
                      !p.active
                        ? 'bg-slate-50/80 opacity-70 dark:bg-slate-200/40'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-200/80'
                    }
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                    <td className="px-4 py-3 text-slate-600">{p.category}</td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={String(p.price)}
                        onChange={(e) => onProductPriceChange(p.id, e.target.value)}
                        className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-sm outline-none focus:border-brand-pink dark:border-slate-300 dark:text-slate-900"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={p.active}
                          onChange={(e) => setProductActive(p.id, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-pink focus:ring-brand-pink"
                        />
                        <span className="text-slate-600">On shelf</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function OrderRow({
  order,
  open,
  onToggle,
  onVoid,
}: {
  order: Order
  open: boolean
  onToggle: () => void
  onVoid: () => void
}) {
  const status =
    order.status === 'void' ? (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
        Void
      </span>
    ) : (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
        Paid
      </span>
    )

  const cn = order.customerName ?? '—'
  const cid = order.customerId ?? '—'

  return (
    <div className="bg-white dark:bg-slate-300 dark:text-slate-900">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-200/80"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-semibold text-slate-900">
            {orderRefFromId(order.id)}
          </p>
          <p className="text-xs text-slate-600">
            {cn} · ID {cid}
          </p>
          <p className="text-xs text-slate-500">
            {new Date(order.createdAt).toLocaleString('en-KE')} · {order.staffLabel} ·{' '}
            <span className="capitalize">{order.paymentMethod}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold text-slate-900">{formatKES(order.total)}</p>
          {status}
        </div>
      </button>
      {open ? (
        <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-4 dark:border-slate-400/50 dark:bg-slate-200/50">
          <ul className="space-y-3 text-sm">
            {order.lines.map((l, i) => (
              <li key={i} className="rounded-xl border border-slate-200 bg-white p-3 text-slate-700 dark:border-slate-300">
                <div className="flex justify-between gap-2 font-medium">
                  <span>
                    {l.qty}× {l.name}
                  </span>
                  <span>{formatKES(l.unitPrice * l.qty)}</span>
                </div>
                {l.imei ? (
                  <p className="mt-1 font-mono text-xs text-slate-500">IMEI {l.imei}</p>
                ) : null}
                {l.serialNumber ? (
                  <p className="font-mono text-xs text-slate-500">S/N {l.serialNumber}</p>
                ) : null}
                {l.warrantyMonths ? (
                  <p className="mt-1 text-xs text-emerald-700">
                    Warranty {l.warrantyMonths} mo
                    {l.warrantyExpiresAt
                      ? ` · expires ${new Date(l.warrantyExpiresAt).toLocaleDateString('en-KE')}`
                      : ''}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {order.note ? (
            <p className="mt-3 text-xs text-slate-500">Note: {order.note}</p>
          ) : null}
          {order.status === 'completed' ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('Void this order? This cannot be undone.')) onVoid()
              }}
              className="mt-4 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              Void order
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

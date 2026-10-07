import {
  ChevronDown,
  ChevronRight,
  Download,
  KeyRound,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  Trash2,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SHOP } from '../brand'
import { PageHeader } from '../components/PageHeader'
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
import { ADMIN_SECTIONS, parseAdminTab } from '../navigation'
import { usePosStore } from '../store/posStore'

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
  const fetchCashiers = usePosStore((s) => s.fetchCashiers)
  const updateAdminCredentials = usePosStore((s) => s.updateAdminCredentials)

  const [searchParams] = useSearchParams()
  const tab = parseAdminTab(searchParams.get('tab'))
  const section = ADMIN_SECTIONS.find((x) => x.key === tab)!
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

  useEffect(() => {
    void fetchCashiers()
  }, [fetchCashiers])

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

  const headerActions =
    tab === 'warranties' ? (
      <button
        type="button"
        onClick={() => {
          const csv = exportWarrantiesCsv(filteredWarranties)
          downloadTextFile(`warranties-${new Date().toISOString().slice(0, 10)}.csv`, csv)
        }}
        className="btn-secondary"
      >
        <Download className="h-4 w-4" />
        Export CSV
      </button>
    ) : tab === 'products' ? (
      <button
        type="button"
        onClick={() => {
          setAddProductMsg('')
          setAddProductOpen((o) => !o)
        }}
        className="btn-primary"
      >
        <Plus className="h-4 w-4" />
        Add product
      </button>
    ) : null

  return (
    <div className="min-w-0">
      <PageHeader title={section.label} description={section.description} actions={headerActions} />

      {tab === 'overview' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard
              icon={TrendingUp}
              label="Today's sales"
              value={formatKES(todayTotal)}
              hint={`${todayOrders.length} completed order${todayOrders.length === 1 ? '' : 's'}`}
            />
            <StatCard
              icon={ShieldCheck}
              label="Active warranties"
              value={String(activeWarrantyCount)}
              hint="Devices under cover"
              tone="success"
            />
            <StatCard
              icon={Users}
              label="Customers"
              value={String(customers.length)}
              hint="Unique profiles"
            />
            <StatCard
              icon={ShoppingCart}
              label="All orders"
              value={String(orders.length)}
              hint={`${orders.filter((o) => o.status === 'void').length} voided`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="card p-6 lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold">Sales by period</h2>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    Completed orders only
                    {salesRange
                      ? ` · ${formatSalesRangeLabel(salesRange.start, salesRange.end)}`
                      : salesPeriod === 'custom'
                        ? ' · pick dates'
                        : ''}
                  </p>
                </div>
                <Segmented
                  value={salesPeriod}
                  onChange={setSalesPeriod}
                  options={[
                    ['week', 'Week'],
                    ['month', 'Month'],
                    ['year', 'Year'],
                    ['custom', 'Custom'],
                  ]}
                />
              </div>
              {salesPeriod === 'custom' ? (
                <div className="mt-5 flex flex-wrap items-end gap-3">
                  <div>
                    <label className="label">From</label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="input w-auto"
                    />
                  </div>
                  <div>
                    <label className="label">To</label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="input w-auto"
                    />
                  </div>
                </div>
              ) : null}
              {customRangeInvalid ? (
                <p className="mt-5 text-sm text-warning">Pick a valid date range (from before to).</p>
              ) : (
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-subtle/70 p-4">
                    <p className="eyebrow">Revenue</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                      {formatKES(periodTotal)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-subtle/70 p-4">
                    <p className="eyebrow">Orders</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                      {periodOrders.length}
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="card flex flex-col p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Store className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">{SHOP.displayName}</h2>
                  <p className="text-xs text-fg-muted">{SHOP.gradeLine}</p>
                </div>
              </div>
              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-2 text-fg-muted">
                    <Phone className="h-4 w-4" /> Phone
                  </dt>
                  <dd className="font-medium">{SHOP.phone}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-2 text-fg-muted">
                    <KeyRound className="h-4 w-4" /> Cashiers
                  </dt>
                  <dd className="font-medium">{cashiers.length}</dd>
                </div>
              </dl>
            </section>
          </div>

          <section className="card p-6">
            <h2 className="text-base font-semibold">Top sellers today</h2>
            {topToday.length === 0 ? (
              <p className="mt-4 text-sm text-fg-muted">No sales recorded today yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {topToday.map((row, i) => (
                  <li key={i} className="flex items-center gap-3 py-3 text-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-fg-muted">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
                    <span className="text-fg-muted">{row.qty} sold</span>
                    <span className="w-28 text-right font-semibold tabular-nums">{formatKES(row.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'orders' ? (
        <div className="space-y-4">
          <SearchInput
            value={orderQuery}
            onChange={setOrderQuery}
            placeholder="Order, customer, ID, IMEI, serial, product…"
          />
          <div className="card divide-y divide-line overflow-hidden">
            {filteredOrders.length === 0 ? (
              <EmptyState>No orders match.</EmptyState>
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
          <SearchInput value={customerQuery} onChange={setCustomerQuery} placeholder="Search by name or ID…" />
          <div className="card divide-y divide-line overflow-hidden">
            {filteredCustomers.length === 0 ? (
              <EmptyState>No customers found.</EmptyState>
            ) : (
              filteredCustomers.map((c) => (
                <div key={c.key}>
                  <button
                    type="button"
                    onClick={() => setCustOpen((x) => ({ ...x, [c.key]: !x[c.key] }))}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-subtle/60 sm:px-5"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                      {c.customerName.trim().slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.customerName}</p>
                      <p className="text-xs text-fg-muted">ID {c.customerId}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold tabular-nums">{formatKES(c.totalSpent)}</p>
                      <p className="text-xs text-fg-muted">
                        {c.orders.length} purchase{c.orders.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    {custOpen[c.key] ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-fg-subtle" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" />
                    )}
                  </button>
                  {custOpen[c.key] ? (
                    <div className="border-t border-line bg-subtle/40 px-4 py-4 sm:px-5">
                      <p className="eyebrow">Purchase history</p>
                      <ul className="mt-3 space-y-2">
                        {c.orders
                          .slice()
                          .sort(
                            (a, b) =>
                              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                          )
                          .map((o) => (
                            <li key={o.id} className="rounded-xl border border-line bg-surface p-3 text-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-mono text-xs font-semibold">{orderRefFromId(o.id)}</span>
                                <span className="font-semibold tabular-nums">{formatKES(o.total)}</span>
                              </div>
                              <p className="mt-1 text-xs text-fg-muted">
                                {new Date(o.createdAt).toLocaleString('en-KE')} · {o.staffLabel} ·{' '}
                                <span className="capitalize">{o.paymentMethod}</span>
                              </p>
                              <ul className="mt-2 space-y-0.5 text-xs text-fg-muted">
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
            <div className="flex-1">
              <SearchInput
                value={warrantyQuery}
                onChange={setWarrantyQuery}
                placeholder="Search customer, IMEI, serial, product…"
              />
            </div>
            <Segmented
              value={warrantyFilter}
              onChange={setWarrantyFilter}
              options={[
                ['all', 'All'],
                ['active', 'Active'],
                ['expired', 'Expired'],
              ]}
            />
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">IMEI / Serial</th>
                  <th className="px-5 py-3">Purchased</th>
                  <th className="px-5 py-3">Expires</th>
                  <th className="px-5 py-3">Days left</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredWarranties.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState>No warranty records match.</EmptyState>
                    </td>
                  </tr>
                ) : (
                  filteredWarranties.map((r) => {
                    const { status, daysLeft } = warrantyRowMeta(r.expiresAt)
                    return (
                      <tr key={r.key} className="transition hover:bg-subtle/50">
                        <td className="px-5 py-3">
                          <p className="font-medium">{r.customerName}</p>
                          <p className="text-xs text-fg-muted">ID {r.customerId}</p>
                          <p className="font-mono text-[11px] text-fg-subtle">{r.orderRef}</p>
                        </td>
                        <td className="px-5 py-3 text-fg-muted">{r.productName}</td>
                        <td className="px-5 py-3 font-mono text-xs text-fg-muted">
                          {r.imei ? <p>IMEI {r.imei}</p> : null}
                          {r.serialNumber ? <p>S/N {r.serialNumber}</p> : null}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-xs text-fg-muted">
                          {new Date(r.purchasedAt).toLocaleDateString('en-KE')}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-xs text-fg-muted">
                          {new Date(r.expiresAt).toLocaleDateString('en-KE')}
                        </td>
                        <td className="px-5 py-3 font-semibold tabular-nums">
                          {status === 'expired' ? '—' : daysLeft}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`capitalize ${status === 'active' ? 'badge-success' : 'badge-neutral'}`}
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
        <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className="card p-6">
            <h2 className="text-base font-semibold">Cashier PINs</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Enter a name, then leave the field — a 4-digit PIN is filled automatically. Tap New PIN
              to roll another. The PIN is shown below each cashier for your reference (stored on this
              device only).
            </p>

            <form
              className="mt-6 grid gap-3 sm:grid-cols-2"
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
              <div className="sm:col-span-2">
                <label className="label">Display name</label>
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
                  className="input"
                />
              </div>
              <div>
                <label className="label">PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={newCashierPin}
                  onChange={(e) => setNewCashierPin(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Confirm PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={newCashierPin2}
                  onChange={(e) => setNewCashierPin2(e.target.value)}
                  className="input"
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const p = randomPin4()
                    setNewCashierPin(p)
                    setNewCashierPin2(p)
                  }}
                >
                  New PIN
                </button>
                <button type="submit" className="btn-primary">
                  Add cashier
                </button>
              </div>
            </form>
            {staffMsg ? <p className="mt-3 text-sm text-success">{staffMsg}</p> : null}

            <ul className="mt-8 divide-y divide-line overflow-hidden rounded-xl border border-line">
              {cashiers.length === 0 ? (
                <li>
                  <EmptyState>No cashiers yet. Add one above.</EmptyState>
                </li>
              ) : (
                cashiers.map((c) => (
                  <li key={c.id} className="px-4 py-4">
                    {editPinId === c.id ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                        <p className="min-w-0 flex-1 font-medium">{c.name}</p>
                        <input
                          type="password"
                          inputMode="numeric"
                          placeholder="New PIN"
                          value={editPin}
                          onChange={(e) => setEditPin(e.target.value)}
                          className="input py-2 sm:w-28"
                        />
                        <input
                          type="password"
                          inputMode="numeric"
                          placeholder="Confirm"
                          value={editPin2}
                          onChange={(e) => setEditPin2(e.target.value)}
                          className="input py-2 sm:w-28"
                        />
                        <button
                          type="button"
                          className="btn-primary py-2"
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
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn-ghost py-2"
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
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                          {c.name.trim().slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{c.name}</p>
                          {c.pinPlain ? (
                            <p className="font-mono text-sm tracking-widest text-fg-muted">{c.pinPlain}</p>
                          ) : (
                            <p className="text-xs text-fg-subtle">Change PIN once to save a reference here.</p>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn-secondary px-3 py-2"
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
                          className="icon-btn hover:bg-danger/10 hover:text-danger"
                          aria-label={`Remove ${c.name}`}
                          onClick={() => {
                            if (confirm(`Remove cashier ${c.name}?`)) removeCashier(c.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="card h-fit p-6">
            <h2 className="text-base font-semibold">Administrator account</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Signed in as <span className="font-medium text-fg">{adminAccount?.email}</span>
            </p>
            <form
              className="mt-6 space-y-4"
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
                <label className="label">Current password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={adminCur}
                  onChange={(e) => setAdminCur(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">New email (optional)</label>
                <input
                  type="email"
                  value={adminNewEmail}
                  onChange={(e) => setAdminNewEmail(e.target.value)}
                  placeholder="Leave blank to keep current"
                  className="input"
                />
              </div>
              <div>
                <label className="label">New password (optional)</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={adminNewPw}
                  onChange={(e) => setAdminNewPw(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={adminNewPw2}
                  onChange={(e) => setAdminNewPw2(e.target.value)}
                  className="input"
                />
              </div>
              <button type="submit" className="btn-primary">
                Update admin account
              </button>
            </form>
            {adminAccountMsg ? <p className="mt-3 text-sm text-fg-muted">{adminAccountMsg}</p> : null}
          </section>
        </div>
      ) : null}

      {tab === 'products' ? (
        <div className="space-y-4">
          {addProductOpen ? (
            <form onSubmit={onAddProduct} className="card p-6">
              <h2 className="text-base font-semibold">New product</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className="label">Name</label>
                  <input
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="e.g. iPhone 15 128GB · Black"
                    className="input"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="label">Category</label>
                  <input
                    value={newProductCategory}
                    onChange={(e) => setNewProductCategory(e.target.value)}
                    placeholder="e.g. iPhone 15"
                    list="admin-product-categories"
                    className="input"
                    autoComplete="off"
                  />
                  <datalist id="admin-product-categories">
                    {productCategories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="label">Price (KSh)</label>
                  <input
                    value={newProductPrice}
                    onChange={(e) => setNewProductPrice(e.target.value)}
                    placeholder="0"
                    inputMode="numeric"
                    className="input font-mono"
                    autoComplete="off"
                  />
                </div>
              </div>
              <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
                <input
                  type="checkbox"
                  checked={newProductActive}
                  onChange={(e) => setNewProductActive(e.target.checked)}
                  className="h-4 w-4 accent-[rgb(var(--accent))]"
                />
                On shelf (active)
              </label>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button type="submit" className="btn-primary">
                  Save product
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddProductOpen(false)
                    setAddProductMsg('')
                  }}
                  className="btn-ghost"
                >
                  Cancel
                </button>
              </div>
              {addProductMsg ? <p className="mt-3 text-sm text-danger">{addProductMsg}</p> : null}
            </form>
          ) : null}

          {addProductMsg && !addProductOpen ? (
            <p className="text-sm text-success">{addProductMsg}</p>
          ) : null}

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Price (KSh)</th>
                  <th className="px-5 py-3">On shelf</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {products.map((p) => (
                  <tr
                    key={p.id}
                    className={!p.active ? 'opacity-55' : 'transition hover:bg-subtle/50'}
                  >
                    <td className="px-5 py-3 font-medium">{p.name}</td>
                    <td className="px-5 py-3 text-fg-muted">{p.category}</td>
                    <td className="px-5 py-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={String(p.price)}
                        onChange={(e) => onProductPriceChange(p.id, e.target.value)}
                        aria-label={`Price for ${p.name}`}
                        className="input w-32 px-3 py-1.5 font-mono"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <Switch
                        checked={p.active}
                        onChange={(v) => setProductActive(p.id, v)}
                        label={`${p.name} on shelf`}
                      />
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

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'accent',
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
  tone?: 'accent' | 'success'
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-fg-muted">{label}</p>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            tone === 'success' ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent'
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 truncate text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-fg-subtle">{hint}</p>
    </div>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: [T, string][]
}) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-subtle p-1">
      {options.map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          aria-pressed={value === k}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            value === k ? 'bg-surface text-fg shadow-card' : 'text-fg-muted hover:text-fg'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="input pl-10"
      />
    </div>
  )
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        checked ? 'bg-accent' : 'bg-line'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-card transition ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-4 py-12 text-center text-sm text-fg-muted">{children}</p>
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
  const cn = order.customerName ?? '—'
  const cid = order.customerId ?? '—'

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-subtle/60 sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm font-semibold">{orderRefFromId(order.id)}</p>
            {order.status === 'void' ? (
              <span className="badge-danger">Void</span>
            ) : (
              <span className="badge-success">Paid</span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-fg-muted">
            {cn} · ID {cid}
          </p>
          <p className="truncate text-xs text-fg-subtle">
            {new Date(order.createdAt).toLocaleString('en-KE')} · {order.staffLabel} ·{' '}
            <span className="capitalize">{order.paymentMethod}</span>
          </p>
        </div>
        <p className="font-semibold tabular-nums">{formatKES(order.total)}</p>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-fg-subtle" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" />
        )}
      </button>
      {open ? (
        <div className="border-t border-line bg-subtle/40 px-4 py-4 sm:px-5">
          <ul className="space-y-2 text-sm">
            {order.lines.map((l, i) => (
              <li key={i} className="rounded-xl border border-line bg-surface p-3">
                <div className="flex justify-between gap-2 font-medium">
                  <span>
                    {l.qty}× {l.name}
                  </span>
                  <span className="tabular-nums">{formatKES(l.unitPrice * l.qty)}</span>
                </div>
                {l.imei ? <p className="mt-1 font-mono text-xs text-fg-muted">IMEI {l.imei}</p> : null}
                {l.serialNumber ? (
                  <p className="font-mono text-xs text-fg-muted">S/N {l.serialNumber}</p>
                ) : null}
                {l.warrantyMonths ? (
                  <p className="mt-1 text-xs text-success">
                    Warranty {l.warrantyMonths} mo
                    {l.warrantyExpiresAt
                      ? ` · expires ${new Date(l.warrantyExpiresAt).toLocaleDateString('en-KE')}`
                      : ''}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {order.note ? <p className="mt-3 text-xs text-fg-muted">Note: {order.note}</p> : null}
          {order.status === 'completed' ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('Void this order? This cannot be undone.')) onVoid()
              }}
              className="btn-danger mt-4 px-3 py-2 text-xs"
            >
              Void order
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

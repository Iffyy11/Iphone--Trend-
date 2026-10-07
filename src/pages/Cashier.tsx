import {
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Smartphone,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { SHOP } from '../brand'
import { DEFAULT_PHONE_WARRANTY_MONTHS, WARRANTY_OPTIONS } from '../data/warrantyOptions'
import { formatKES, orderRefFromId } from '../lib/format'
import { isAccessoryProduct } from '../lib/products'
import type { Order, OrderLine, PaymentMethod, Product } from '../types'
import { PageHeader } from '../components/PageHeader'
import { ReceiptPrint } from '../components/ReceiptPrint'
import { usePosStore } from '../store/posStore'

type DeviceDraft = { imei: string; serial: string; warrantyMonths: number }

type CartLine = {
  rowId: string
  product: Product
  qty: number
  /** One entry per unit for phones; ignored for accessories */
  devices: DeviceDraft[]
}

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function Cashier() {
  const products = usePosStore((s) => s.products)
  const addOrder = usePosStore((s) => s.addOrder)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('All')
  const [cart, setCart] = useState<CartLine[]>([])
  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [lastOrder, setLastOrder] = useState<Order | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category))
    return ['All', ...[...set].sort()]
  }, [products])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return products.filter((p) => {
      if (!p.active) return false
      if (cat !== 'All' && p.category !== cat) return false
      if (!needle) return true
      return (
        p.name.toLowerCase().includes(needle) ||
        p.category.toLowerCase().includes(needle)
      )
    })
  }, [products, q, cat])

  function emptyDevice(): DeviceDraft {
    return {
      imei: '',
      serial: '',
      warrantyMonths: DEFAULT_PHONE_WARRANTY_MONTHS,
    }
  }

  function addToCart(p: Product) {
    if (isAccessoryProduct(p)) {
      setCart((prev) => {
        const i = prev.findIndex((x) => x.product.id === p.id)
        if (i === -1) {
          return [
            ...prev,
            {
              rowId: newId(),
              product: p,
              qty: 1,
              devices: [],
            },
          ]
        }
        const next = [...prev]
        next[i] = { ...next[i], qty: next[i].qty + 1 }
        return next
      })
      return
    }
    setCart((prev) => [
      ...prev,
      {
        rowId: newId(),
        product: p,
        qty: 1,
        devices: [emptyDevice()],
      },
    ])
  }

  function setAccessoryQty(productId: string, qty: number) {
    if (qty < 1) {
      setCart((prev) => prev.filter((x) => !(isAccessoryProduct(x.product) && x.product.id === productId)))
      return
    }
    setCart((prev) =>
      prev.map((x) =>
        isAccessoryProduct(x.product) && x.product.id === productId ? { ...x, qty } : x,
      ),
    )
  }

  function removeRow(rowId: string) {
    setCart((prev) => prev.filter((x) => x.rowId !== rowId))
  }

  function setPhoneQty(rowId: string, qty: number) {
    if (qty < 1) {
      removeRow(rowId)
      return
    }
    setCart((prev) =>
      prev.map((x) => {
        if (x.rowId !== rowId) return x
        const devices = [...x.devices]
        while (devices.length < qty) devices.push(emptyDevice())
        devices.length = qty
        return { ...x, qty, devices }
      }),
    )
  }

  function updateDevice(
    rowId: string,
    index: number,
    patch: Partial<DeviceDraft>,
  ) {
    setCart((prev) =>
      prev.map((x) => {
        if (x.rowId !== rowId) return x
        const devices = x.devices.map((d, i) =>
          i === index ? { ...d, ...patch } : d,
        )
        return { ...x, devices }
      }),
    )
  }

  const subtotal = cart.reduce((a, l) => {
    if (isAccessoryProduct(l.product)) return a + l.product.price * l.qty
    return a + l.product.price * l.devices.length
  }, 0)

  function buildLines(): OrderLine[] {
    const lines: OrderLine[] = []
    for (const row of cart) {
      if (isAccessoryProduct(row.product)) {
        lines.push({
          productId: row.product.id,
          name: row.product.name,
          qty: row.qty,
          unitPrice: row.product.price,
          warrantyMonths: 0,
        })
        continue
      }
      for (const d of row.devices) {
        lines.push({
          productId: row.product.id,
          name: row.product.name,
          qty: 1,
          unitPrice: row.product.price,
          imei: d.imei.trim(),
          serialNumber: d.serial.trim(),
          warrantyMonths: d.warrantyMonths,
        })
      }
    }
    return lines
  }

  function checkout() {
    setCheckoutError('')
    if (cart.length === 0) return
    if (!customerName.trim() || !customerId.trim()) {
      setCheckoutError('Enter customer name and ID before completing the sale.')
      return
    }
    for (const row of cart) {
      if (isAccessoryProduct(row.product)) continue
      for (let i = 0; i < row.devices.length; i++) {
        const d = row.devices[i]
        if (d.imei.trim().length < 8) {
          setCheckoutError(`IMEI too short for ${row.product.name} (unit ${i + 1}).`)
          return
        }
        if (d.serial.trim().length < 4) {
          setCheckoutError(`Serial number missing for ${row.product.name} (unit ${i + 1}).`)
          return
        }
      }
    }
    const lines = buildLines()
    const order = addOrder({
      lines,
      paymentMethod: payment,
      customerName: customerName.trim(),
      customerId: customerId.trim(),
      note: note.trim() || undefined,
    })
    if (order) {
      setLastOrder(order)
      setShowReceipt(true)
      setCart([])
      setNote('')
      setCustomerName('')
      setCustomerId('')
    }
  }

  const unitCount = cart.reduce((a, l) => {
    if (isAccessoryProduct(l.product)) return a + l.qty
    return a + l.devices.length
  }, 0)

  return (
    <div className="min-w-0">
      <PageHeader title="Point of sale" description={SHOP.gradeLine} />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="no-print min-w-0 space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search models…"
              className="input py-3 pl-10"
            />
          </div>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={`chip ${cat === c ? 'chip-active' : ''}`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addToCart(p)}
                className="card group flex flex-col p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-pop focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-subtle text-fg-muted transition group-hover:bg-accent/10 group-hover:text-accent">
                  <Smartphone className="h-5 w-5" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{p.category}</p>
                <p className="mt-0.5 line-clamp-2 text-sm font-medium text-fg">{p.name}</p>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <p className="text-base font-semibold tabular-nums text-fg">{formatKES(p.price)}</p>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white opacity-0 transition group-hover:opacity-100">
                    <Plus className="h-4 w-4" />
                  </span>
                </div>
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div className="card p-10 text-center text-sm text-fg-muted">No matching products.</div>
          ) : null}
        </div>

        <aside className="no-print h-fit min-w-0 xl:sticky xl:top-8">
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-5 py-4">
              <ShoppingBag className="h-5 w-5 text-accent" />
              <h2 className="text-base font-semibold">Current sale</h2>
              <span className="badge-neutral ml-auto tabular-nums">
                {unitCount} unit{unitCount === 1 ? '' : 's'}
              </span>
            </div>

            <div className="space-y-3 border-b border-line px-5 py-4">
              <p className="eyebrow flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Customer · required
              </p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Full name"
                  aria-label="Customer full name"
                  className="input"
                />
                <input
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  placeholder="National ID / Passport"
                  aria-label="Customer national ID or passport"
                  className="input"
                />
              </div>
            </div>

            <ul className="max-h-[min(48vh,26rem)] space-y-3 overflow-y-auto px-5 py-4">
              {cart.length === 0 ? (
                <li className="flex flex-col items-center py-8 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-fg-subtle">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-fg">Cart is empty</p>
                  <p className="mt-0.5 text-xs text-fg-muted">Tap a product to add it.</p>
                </li>
              ) : (
                cart.map((row) =>
                  isAccessoryProduct(row.product) ? (
                    <li key={row.rowId} className="rounded-xl border border-line bg-subtle/50 p-3">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{row.product.name}</p>
                          <p className="text-xs text-fg-muted">{formatKES(row.product.price)} each</p>
                        </div>
              <div className="flex shrink-0 items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
                <button type="button" aria-label="Decrease" onClick={() => setAccessoryQty(row.product.id, row.qty - 1)} className="icon-btn h-7 w-7">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-semibold tabular-nums">{row.qty}</span>
                <button type="button" aria-label="Increase" onClick={() => setAccessoryQty(row.product.id, row.qty + 1)} className="icon-btn h-7 w-7">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <button type="button" aria-label="Remove" onClick={() => removeRow(row.rowId)} className="icon-btn h-8 w-8 hover:bg-danger/10 hover:text-danger">
                <Trash2 className="h-4 w-4" />
              </button>
                      </div>
                    </li>
                  ) : (
                    <li key={row.rowId} className="rounded-xl border border-line bg-subtle/50 p-3">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{row.product.name}</p>
                          <p className="text-xs text-fg-muted">{formatKES(row.product.price)} each</p>
                        </div>
              <div className="flex shrink-0 items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
                <button type="button" aria-label="Decrease" onClick={() => setPhoneQty(row.rowId, row.devices.length - 1)} className="icon-btn h-7 w-7">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-semibold tabular-nums">{row.devices.length}</span>
                <button type="button" aria-label="Increase" onClick={() => setPhoneQty(row.rowId, row.devices.length + 1)} className="icon-btn h-7 w-7">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <button type="button" aria-label="Remove" onClick={() => removeRow(row.rowId)} className="icon-btn h-8 w-8 hover:bg-danger/10 hover:text-danger">
                <Trash2 className="h-4 w-4" />
              </button>
                      </div>
                      <div className="mt-3 space-y-2">
                        {row.devices.map((d, idx) => (
                          <div key={idx} className="rounded-lg border border-line bg-surface p-3">
                            <p className="eyebrow mb-2">Device {idx + 1}</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input
                                value={d.imei}
                                onChange={(e) => updateDevice(row.rowId, idx, { imei: e.target.value })}
                                placeholder="IMEI"
                                aria-label={`IMEI for device ${idx + 1}`}
                                inputMode="numeric"
                                className="input px-3 py-2 font-mono text-xs"
                              />
                              <input
                                value={d.serial}
                                onChange={(e) => updateDevice(row.rowId, idx, { serial: e.target.value })}
                                placeholder="Serial number"
                                aria-label={`Serial number for device ${idx + 1}`}
                                className="input px-3 py-2 font-mono text-xs"
                              />
                            </div>
                            <select
                              value={d.warrantyMonths}
                              onChange={(e) =>
                                updateDevice(row.rowId, idx, { warrantyMonths: Number(e.target.value) })
                              }
                              aria-label={`Warranty for device ${idx + 1}`}
                              className="input mt-2 px-3 py-2 text-xs"
                            >
                              {WARRANTY_OPTIONS.map((o) => (
                                <option key={o.months} value={o.months}>
                                  Warranty · {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </li>
                  ),
                )
              )}
            </ul>

            <div className="space-y-4 border-t border-line bg-subtle/40 px-5 py-4">
              <div>
                <p className="label">Payment method</p>
                <div className="grid grid-cols-4 gap-1 rounded-xl border border-line bg-subtle p-1">
                  {(
                    [
                      ['cash', 'Cash'],
                      ['mpesa', 'M-Pesa'],
                      ['card', 'Card'],
                      ['other', 'Other'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPayment(value)}
                      aria-pressed={payment === value}
                      className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                        payment === value ? 'bg-surface text-fg shadow-card' : 'text-fg-muted hover:text-fg'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Sale note (optional)"
                aria-label="Sale note"
                className="input"
              />
              {checkoutError ? (
                <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {checkoutError}
                </p>
              ) : null}
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-fg-muted">Total</span>
                <span className="text-2xl font-semibold tabular-nums tracking-tight">{formatKES(subtotal)}</span>
              </div>
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={checkout}
                className="btn-primary w-full py-3"
              >
                Complete sale
              </button>
            </div>
          </div>
        </aside>
      </div>

      {showReceipt && lastOrder ? (
        <>
          <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-8 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="max-h-[min(90dvh,90vh)] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-pop sm:rounded-2xl sm:p-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="badge-success">Sale complete</span>
                  <p className="mt-2 text-lg font-semibold">Order {orderRefFromId(lastOrder.id)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReceipt(false)}
                  className="icon-btn"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 rounded-xl border border-line bg-subtle/60 px-3 py-2.5 text-sm">
                <p className="eyebrow">Customer</p>
                <p className="mt-0.5 font-medium">{lastOrder.customerName ?? '—'}</p>
                <p className="text-xs text-fg-muted">ID: {lastOrder.customerId ?? '—'}</p>
              </div>
              <ul className="mt-4 space-y-3 border-y border-line py-4 text-sm">
                {lastOrder.lines.map((l, i) => (
                  <li key={i}>
                    <div className="flex justify-between gap-2 font-medium">
                      <span>
                        {l.qty}× {l.name}
                      </span>
                      <span className="tabular-nums">{formatKES(l.unitPrice * l.qty)}</span>
                    </div>
                    {l.imei || l.serialNumber || (l.warrantyMonths ?? 0) > 0 ? (
                      <div className="mt-1.5 space-y-0.5 text-xs text-fg-muted">
                        <p>
                          IMEI <span className="font-mono text-fg">{l.imei?.trim() || '—'}</span>
                        </p>
                        <p>
                          Serial <span className="font-mono text-fg">{l.serialNumber?.trim() || '—'}</span>
                        </p>
                        <p>
                          Warranty{' '}
                          <span className="text-fg">
                            {l.warrantyMonths
                              ? `${l.warrantyMonths} mo${
                                  l.warrantyExpiresAt
                                    ? ` · ends ${new Date(l.warrantyExpiresAt).toLocaleDateString('en-KE')}`
                                    : ''
                                }`
                              : '—'}
                          </span>
                        </p>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-sm capitalize text-fg-muted">Total · {lastOrder.paymentMethod}</span>
                <span className="text-xl font-semibold tabular-nums">{formatKES(lastOrder.total)}</span>
              </div>
              <div className="mt-6 flex gap-2">
                <button type="button" onClick={() => window.print()} className="btn-primary flex-1">
                  <Printer className="h-4 w-4" />
                  Print receipt
                </button>
                <button type="button" onClick={() => setShowReceipt(false)} className="btn-secondary">
                  Done
                </button>
              </div>
            </div>
          </div>
          <ReceiptPrint order={lastOrder} />
        </>
      ) : null}
    </div>
  )
}

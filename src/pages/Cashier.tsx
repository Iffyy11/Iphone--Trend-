import {
  CheckCircle2,
  ChevronUp,
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { SHOP } from '../brand'
import { DEFAULT_PHONE_WARRANTY_MONTHS, WARRANTY_OPTIONS } from '../data/warrantyOptions'
import { formatKES, orderRefFromId } from '../lib/format'
import { colourSwatch, describeProduct, isAccessoryProduct } from '../lib/products'
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

/** Newest iPhones first, then other brands A–Z, accessories last. */
function compareCategories(a: string, b: string) {
  const rank = (c: string) => (c === 'Accessories' ? 2 : /^iPhone \d+/.test(c) ? 0 : 1)
  if (rank(a) !== rank(b)) return rank(a) - rank(b)
  const na = Number(a.match(/\d+/)?.[0] ?? 0)
  const nb = Number(b.match(/\d+/)?.[0] ?? 0)
  return rank(a) === 0 ? nb - na : a.localeCompare(b)
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
  const [cartOpen, setCartOpen] = useState(false)

  const categories = useMemo(() => {
    const set = new Set(products.filter((p) => p.active).map((p) => p.category))
    return ['All', ...[...set].sort(compareCategories)]
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
    setCart((prev) => {
      const i = prev.findIndex((x) => x.product.id === p.id)
      if (i !== -1) {
        const next = [...prev]
        const devices = [...next[i].devices, emptyDevice()]
        next[i] = { ...next[i], qty: devices.length, devices }
        return next
      }
      return [
        ...prev,
        {
          rowId: newId(),
          product: p,
          qty: 1,
          devices: [emptyDevice()],
        },
      ]
    })
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
      setCartOpen(false)
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

  const unitsByProduct = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of cart) {
      const n = isAccessoryProduct(l.product) ? l.qty : l.devices.length
      m.set(l.product.id, (m.get(l.product.id) ?? 0) + n)
    }
    return m
  }, [cart])

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) if (p.active) m.set(p.category, (m.get(p.category) ?? 0) + 1)
    return m
  }, [products])

  const groups = useMemo(() => {
    if (cat !== 'All' || q.trim()) return [{ title: '', items: filtered }]
    return categories
      .slice(1)
      .map((c) => ({ title: c, items: filtered.filter((p) => p.category === c) }))
      .filter((g) => g.items.length > 0)
  }, [filtered, cat, q, categories])

  function clearSale() {
    if (cart.length > 0 && !confirm('Clear all items from this sale?')) return
    setCart([])
    setCheckoutError('')
  }

  function deviceComplete(d: DeviceDraft) {
    return d.imei.trim().length >= 8 && d.serial.trim().length >= 4
  }

  const qtyStepper = (qty: number, dec: () => void, inc: () => void) => (
    <div className="flex shrink-0 items-center rounded-lg border border-line bg-surface">
      <button type="button" aria-label="Decrease" onClick={dec} className="icon-btn h-8 w-8 rounded-r-none">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-7 text-center text-sm font-semibold tabular-nums">{qty}</span>
      <button type="button" aria-label="Increase" onClick={inc} className="icon-btn h-8 w-8 rounded-l-none">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )

  const salePanel = (onClose?: () => void) => (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold">Current sale</h2>
        <span className="badge-neutral tabular-nums">
          {unitCount} item{unitCount === 1 ? '' : 's'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {cart.length > 0 ? (
            <button type="button" onClick={clearSale} className="btn-ghost px-2.5 py-1.5 text-xs">
              Clear
            </button>
          ) : null}
          {onClose ? (
            <button type="button" onClick={onClose} className="icon-btn" aria-label="Close sale">
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold">No items yet</p>
            <p className="mt-1 max-w-[16rem] text-xs text-fg-muted">
              Tap a product to add it. Phones ask for IMEI, serial and warranty.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {cart.map((row) => {
              const parts = describeProduct(row.product.name)
              const accessory = isAccessoryProduct(row.product)
              const units = accessory ? row.qty : row.devices.length
              return (
                <li key={row.rowId} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{parts.model}</p>
                      <p className="mt-0.5 truncate text-xs text-fg-muted">
                        {[parts.storage, parts.sim, parts.colour].filter(Boolean).join(' · ') ||
                          row.product.category}
                      </p>
                      <p className="mt-1 text-sm font-semibold tabular-nums">
                        {formatKES(row.product.price * units)}
                        {units > 1 ? (
                          <span className="ml-1.5 text-xs font-normal text-fg-subtle">
                            {formatKES(row.product.price)} each
                          </span>
                        ) : null}
                      </p>
                    </div>
                    {accessory
                      ? qtyStepper(
                          row.qty,
                          () => setAccessoryQty(row.product.id, row.qty - 1),
                          () => setAccessoryQty(row.product.id, row.qty + 1),
                        )
                      : qtyStepper(
                          row.devices.length,
                          () => setPhoneQty(row.rowId, row.devices.length - 1),
                          () => setPhoneQty(row.rowId, row.devices.length + 1),
                        )}
                    <button
                      type="button"
                      aria-label={`Remove ${row.product.name}`}
                      onClick={() => removeRow(row.rowId)}
                      className="icon-btn h-8 w-8 hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {!accessory ? (
                    <div className="mt-3 space-y-2">
                      {row.devices.map((d, idx) => {
                        const done = deviceComplete(d)
                        return (
                          <div
                            key={idx}
                            className={`rounded-xl border p-3 transition ${
                              done ? 'border-success/30 bg-success/5' : 'border-line bg-subtle/50'
                            }`}
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <p className="eyebrow">Device {idx + 1}</p>
                              {done ? (
                                <span className="flex items-center gap-1 text-[11px] font-semibold text-success">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                                </span>
                              ) : (
                                <span className="text-[11px] font-medium text-warning">
                                  Needs IMEI &amp; serial
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
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
                                placeholder="Serial no."
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
                        )
                      })}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}

        <div className="space-y-2 border-t border-line px-5 py-4">
          <p className="eyebrow flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Customer
          </p>
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
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Sale note (optional)"
            aria-label="Sale note"
            className="input"
          />
        </div>
      </div>

      <div className="space-y-3 border-t border-line bg-subtle/50 px-5 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-4">
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
              className={`rounded-lg py-2 text-xs font-semibold transition ${
                payment === value ? 'bg-surface text-fg shadow-card' : 'text-fg-muted hover:text-fg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {checkoutError ? (
          <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
            {checkoutError}
          </p>
        ) : null}
        <button
          type="button"
          disabled={cart.length === 0}
          onClick={checkout}
          className="btn-primary flex w-full items-center justify-between px-5 py-3.5 text-base"
        >
          <span>Complete sale</span>
          <span className="tabular-nums">{formatKES(subtotal)}</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-w-0 pb-24 xl:pb-0">
      <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="no-print min-w-0">
          <PageHeader title="Point of sale" description={SHOP.gradeLine} />

          <div className="sticky top-[60px] z-10 -mx-4 space-y-3 bg-canvas/90 px-4 pb-4 pt-1 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10 lg:pt-4 xl:-mr-0 xl:pr-0">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search models, storage, colour…"
                aria-label="Search products"
                className="input rounded-2xl py-3 pl-11 pr-20 shadow-card"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-fg-subtle">
                {filtered.length} items
              </span>
            </div>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(c)}
                  className={`chip gap-1.5 ${cat === c ? 'chip-active' : ''}`}
                >
                  {c}
                  <span className={`tabular-nums ${cat === c ? 'text-white/70' : 'text-fg-subtle'}`}>
                    {c === 'All' ? products.filter((p) => p.active).length : categoryCounts.get(c) ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            {groups.map((g) => (
              <section key={g.title || 'results'}>
                {g.title ? (
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
                    {g.title}
                    <span className="text-xs font-normal text-fg-subtle">{g.items.length}</span>
                  </h3>
                ) : null}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {g.items.map((p) => {
                    const parts = describeProduct(p.name)
                    const inCart = unitsByProduct.get(p.id) ?? 0
                    const swatch = parts.colour ? colourSwatch(parts.colour) : undefined
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addToCart(p)}
                        className={`card group relative flex min-h-[8.5rem] flex-col p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-pop focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20 ${
                          inCart ? 'border-accent/50 ring-2 ring-accent/15' : ''
                        }`}
                      >
                        {inCart ? (
                          <span className="badge absolute right-3 top-3 bg-accent text-white">
                            {inCart} in sale
                          </span>
                        ) : null}
                        <p className="pr-20 text-[15px] font-semibold leading-snug text-fg">{parts.model}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {parts.storage ? <span className="tag">{parts.storage}</span> : null}
                          {parts.sim ? <span className="tag">{parts.sim}</span> : null}
                          {parts.colour ? (
                            <span className="tag">
                              {swatch ? (
                                <span
                                  className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                                  style={{ backgroundColor: swatch }}
                                />
                              ) : null}
                              {parts.colour}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-auto flex items-end justify-between pt-4">
                          <p className="text-lg font-semibold tabular-nums tracking-tight">
                            {formatKES(p.price)}
                          </p>
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-subtle text-fg-muted transition group-hover:bg-accent group-hover:text-white">
                            <Plus className="h-4 w-4" />
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-sm font-medium">No matching products</p>
              <p className="mt-1 text-xs text-fg-muted">Try another search or category.</p>
            </div>
          ) : null}
        </div>

        {/* Desktop sale panel */}
        <aside className="no-print card sticky top-8 hidden h-[calc(100dvh-4rem)] min-w-0 overflow-hidden xl:block">
          {salePanel()}
        </aside>
      </div>

      {/* Mobile / tablet: bottom bar + sheet */}
      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-lg lg:left-64 xl:hidden">
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="btn-primary flex w-full items-center justify-between px-5 py-3.5"
        >
          <span className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Review sale · {unitCount} item{unitCount === 1 ? '' : 's'}
          </span>
          <span className="flex items-center gap-1 tabular-nums">
            {formatKES(subtotal)}
            <ChevronUp className="h-4 w-4" />
          </span>
        </button>
      </div>
      {cartOpen ? (
        <div className="no-print fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            aria-label="Close sale"
            onClick={() => setCartOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 bottom-0 top-[max(2.5rem,env(safe-area-inset-top,0px))] overflow-hidden rounded-t-3xl bg-surface shadow-pop sm:left-auto sm:top-0 sm:w-[420px] sm:rounded-none">
            {salePanel(() => setCartOpen(false))}
          </div>
        </div>
      ) : null}

      {showReceipt && lastOrder ? (
        <>
          <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-8 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="max-h-[min(90dvh,90vh)] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-pop sm:rounded-2xl sm:p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-success/10 text-success">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Sale complete</p>
                    <p className="font-mono text-xs text-fg-muted">Order {orderRefFromId(lastOrder.id)}</p>
                  </div>
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
                  New sale
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

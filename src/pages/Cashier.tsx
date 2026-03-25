import {
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
import { isAccessoryProduct } from '../lib/products'
import type { Order, OrderLine, PaymentMethod, Product } from '../types'
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

  return (
    <div className="grid min-w-0 gap-6 text-slate-900 dark:text-slate-900 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="min-w-0 space-y-4">
        <div className="no-print rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100 dark:border-slate-400/40 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-400/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Catalogue
          </p>
          <p className="mt-1 text-sm text-slate-600">{SHOP.gradeLine}</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search models…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand-pink focus:bg-white focus:ring-2 focus:ring-brand-pink/20 dark:border-slate-300 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-400 dark:focus:bg-white"
              />
            </div>
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-pink/20 dark:border-slate-300 dark:bg-white dark:text-slate-900 dark:focus:bg-white"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => addToCart(p)}
              className="no-print group rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-sm ring-1 ring-slate-100 transition hover:border-brand-pink/35 hover:shadow-md dark:border-slate-400/40 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-400/20 dark:hover:border-brand-pink/50"
            >
              <p className="text-xs font-medium text-brand-pink">{p.category}</p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-900">
                {p.name}
              </p>
              <p className="mt-3 text-lg font-bold text-slate-900 dark:text-slate-900">
                {formatKES(p.price)}
              </p>
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-slate-500">No matching products.</p>
        ) : null}
      </div>

      <aside className="no-print h-fit min-w-0 space-y-4 lg:sticky lg:top-24">
        <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 p-5 shadow-lg shadow-slate-200/40 ring-1 ring-slate-100 dark:border-slate-400/40 dark:from-slate-300 dark:to-slate-300 dark:text-slate-900 dark:shadow-none dark:ring-slate-400/20">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-400/50">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-pink/15 text-brand-pink">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Customer</h2>
              <p className="text-xs text-slate-500">Required for every sale</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Full name</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-pink/15 dark:border-slate-300 dark:text-slate-900 dark:placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                National ID / Passport
              </label>
              <input
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="ID number"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-pink/15 dark:border-slate-300 dark:text-slate-900 dark:placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100 dark:border-slate-400/40 dark:bg-slate-300 dark:text-slate-900 dark:shadow-none dark:ring-slate-400/20">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-400/50">
            <ShoppingBag className="h-5 w-5 text-brand-green" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-900">Cart</h2>
            <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-200 dark:text-slate-700">
              {cart.reduce((a, l) => {
                if (isAccessoryProduct(l.product)) return a + l.qty
                return a + l.devices.length
              }, 0)}{' '}
              units
            </span>
          </div>

          <ul className="max-h-[min(52vh,28rem)] space-y-4 overflow-y-auto py-4">
            {cart.length === 0 ? (
              <li className="py-10 text-center text-sm text-slate-400">Cart is empty</li>
            ) : (
              cart.map((row) =>
                isAccessoryProduct(row.product) ? (
                  <li
                    key={row.rowId}
                    className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-400/40 dark:bg-slate-200/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-900">{row.product.name}</p>
                        <p className="text-xs text-slate-500">{formatKES(row.product.price)} each</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Decrease"
                          onClick={() => setAccessoryQty(row.product.id, row.qty - 1)}
                          className="rounded-lg border border-slate-200 bg-white p-1.5 hover:bg-slate-100 dark:border-slate-300 dark:bg-white dark:hover:bg-slate-100"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{row.qty}</span>
                        <button
                          type="button"
                          aria-label="Increase"
                          onClick={() => setAccessoryQty(row.product.id, row.qty + 1)}
                          className="rounded-lg border border-slate-200 bg-white p-1.5 hover:bg-slate-100 dark:border-slate-300 dark:bg-white dark:hover:bg-slate-100"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Remove"
                          onClick={() => removeRow(row.rowId)}
                          className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ) : (
                  <li key={row.rowId} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-400/40 dark:bg-slate-200/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-900">{row.product.name}</p>
                        <p className="text-xs text-slate-500">{formatKES(row.product.price)} each</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPhoneQty(row.rowId, row.devices.length - 1)}
                          className="rounded-lg border border-slate-200 bg-white p-1.5 hover:bg-slate-100 dark:border-slate-300 dark:bg-white dark:hover:bg-slate-100"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">
                          {row.devices.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPhoneQty(row.rowId, row.devices.length + 1)}
                          className="rounded-lg border border-slate-200 bg-white p-1.5 hover:bg-slate-100 dark:border-slate-300 dark:bg-white dark:hover:bg-slate-100"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(row.rowId)}
                          className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-3">
                      {row.devices.map((d, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-white/80 bg-white p-3 shadow-sm dark:border-slate-300 dark:bg-white"
                        >
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Device {idx + 1}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              value={d.imei}
                              onChange={(e) =>
                                updateDevice(row.rowId, idx, { imei: e.target.value })
                              }
                              placeholder="IMEI"
                              inputMode="numeric"
                              className="rounded-lg border border-slate-200 px-2 py-2 font-mono text-xs outline-none focus:border-brand-pink dark:border-slate-300 dark:bg-white dark:text-slate-900"
                            />
                            <input
                              value={d.serial}
                              onChange={(e) =>
                                updateDevice(row.rowId, idx, { serial: e.target.value })
                              }
                              placeholder="Serial number"
                              className="rounded-lg border border-slate-200 px-2 py-2 font-mono text-xs outline-none focus:border-brand-pink dark:border-slate-300 dark:bg-white dark:text-slate-900"
                            />
                          </div>
                          <label className="mt-2 block text-[11px] font-medium text-slate-500">
                            Warranty
                          </label>
                          <select
                            value={d.warrantyMonths}
                            onChange={(e) =>
                              updateDevice(row.rowId, idx, {
                                warrantyMonths: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs outline-none focus:border-brand-pink dark:border-slate-300 dark:bg-white dark:text-slate-900"
                          >
                            {WARRANTY_OPTIONS.map((o) => (
                              <option key={o.months} value={o.months}>
                                {o.label}
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

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Payment
            </label>
            <select
              value={payment}
              onChange={(e) => setPayment(e.target.value as PaymentMethod)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm outline-none focus:border-brand-pink focus:bg-white dark:border-slate-300 dark:bg-white dark:text-slate-900 dark:focus:bg-white"
            >
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sale note (optional)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Internal note"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm outline-none focus:border-brand-pink focus:bg-white dark:border-slate-300 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-400 dark:focus:bg-white"
            />
            {checkoutError ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{checkoutError}</p>
            ) : null}
            <div className="flex items-center justify-between text-lg font-bold text-slate-900 dark:text-slate-900">
              <span>Total</span>
              <span>{formatKES(subtotal)}</span>
            </div>
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={checkout}
              className="w-full rounded-xl bg-brand-green py-3.5 text-sm font-bold text-white shadow-md shadow-brand-green/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Complete sale
            </button>
          </div>
        </div>
      </aside>

      {showReceipt && lastOrder ? (
        <>
          <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-8 backdrop-blur-sm sm:items-center sm:p-4 sm:pb-4 sm:pt-4">
            <div className="max-h-[min(90dvh,90vh)] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 sm:rounded-2xl sm:p-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Sale complete</p>
                  <p className="text-lg font-bold text-slate-900">
                    Order {orderRefFromId(lastOrder.id)}
                  </p>
                  <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2 text-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Customer
                    </p>
                    <p className="font-semibold text-slate-900">{lastOrder.customerName ?? '—'}</p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      ID: {lastOrder.customerId ?? '—'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReceipt(false)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ul className="mt-4 space-y-3 border-y border-slate-100 py-4 text-sm">
                {lastOrder.lines.map((l, i) => (
                  <li key={i} className="border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                    <div className="flex justify-between gap-2 font-medium">
                      <span className="text-slate-700">
                        {l.qty}× {l.name}
                      </span>
                      <span>{formatKES(l.unitPrice * l.qty)}</span>
                    </div>
                    {l.imei || l.serialNumber || (l.warrantyMonths ?? 0) > 0 ? (
                      <div className="mt-2 space-y-0.5 rounded-lg border border-slate-100 bg-white px-2 py-1.5 text-xs text-slate-700">
                        <p>
                          <span className="font-semibold text-slate-500">IMEI: </span>
                          <span className="font-mono">{l.imei?.trim() || '—'}</span>
                        </p>
                        <p>
                          <span className="font-semibold text-slate-500">Serial: </span>
                          <span className="font-mono">{l.serialNumber?.trim() || '—'}</span>
                        </p>
                        <p>
                          <span className="font-semibold text-slate-500">Warranty: </span>
                          {l.warrantyMonths
                            ? `${l.warrantyMonths} mo${
                                l.warrantyExpiresAt
                                  ? ` · ends ${new Date(l.warrantyExpiresAt).toLocaleDateString('en-KE')}`
                                  : ''
                              }`
                            : '—'}
                        </p>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatKES(lastOrder.total)}</span>
              </p>
              <p className="mt-1 text-xs capitalize text-slate-500">{lastOrder.paymentMethod}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                >
                  <Printer className="h-4 w-4" />
                  Print receipt
                </button>
                <button
                  type="button"
                  onClick={() => setShowReceipt(false)}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
                >
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

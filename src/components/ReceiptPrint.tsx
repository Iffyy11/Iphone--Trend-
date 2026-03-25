import { SHOP } from '../brand'
import { formatKES, orderRefFromId } from '../lib/format'
import type { Order } from '../types'
import { LogoMark } from './LogoMark'

export function ReceiptPrint({ order }: { order: Order }) {
  const cust = order.customerName?.trim() || '—'
  const cid = order.customerId?.trim() || '—'
  const dateStr = new Date(order.createdAt).toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div className="hidden print:block print:bg-white">
      <article className="receipt-print mx-auto max-w-[300px] bg-white px-6 py-8 text-slate-900">
        {/* Brand */}
        <header className="border-b-2 border-slate-900 pb-4 text-center">
          <div className="mx-auto mb-3 flex justify-center">
            <LogoMark
              size="md"
              className="shadow-lg ring-2 ring-brand-pink/40 print:shadow-none"
            />
          </div>
          <h1 className="font-sans text-lg font-bold tracking-tight text-slate-900">
            {SHOP.displayName}
          </h1>
          <p className="mt-1 font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
            {SHOP.gradeLine}
          </p>
        </header>

        {/* Receipt meta */}
        <section className="mt-4 space-y-2 border-b border-dashed border-slate-300 pb-4">
          <div className="flex items-start justify-between gap-2 font-sans text-[11px]">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Receipt</span>
            <span className="text-right font-mono font-bold text-slate-900">
              {orderRefFromId(order.id)}
            </span>
          </div>
          <div className="flex justify-between gap-2 font-sans text-[10px] text-slate-600">
            <span>{dateStr}</span>
          </div>
          <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 font-sans text-[10px] text-slate-600">
            <span>
              <span className="font-semibold text-slate-500">Staff</span> {order.staffLabel}
            </span>
            <span className="capitalize">
              <span className="font-semibold text-slate-500">Pay</span> {order.paymentMethod}
            </span>
          </div>
        </section>

        {/* Customer */}
        <section className="mt-4 border-b border-dashed border-slate-300 pb-4">
          <p className="font-sans text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Customer
          </p>
          <p className="mt-2 font-sans text-sm font-semibold leading-snug text-slate-900">{cust}</p>
          <p className="mt-1 font-sans text-[11px] text-slate-600">
            <span className="text-slate-400">ID</span> {cid}
          </p>
        </section>

        {/* Line items */}
        <section className="mt-4">
          <div className="mb-2 flex items-end justify-between border-b border-slate-200 pb-1 font-sans text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
            <span>Item</span>
            <span className="shrink-0">Amount</span>
          </div>
          <ul className="space-y-4">
            {order.lines.map((l, i) => {
              const isPhoneLine =
                Boolean(l.imei?.trim()) ||
                Boolean(l.serialNumber?.trim()) ||
                (l.warrantyMonths ?? 0) > 0
              return (
                <li key={i} className="font-sans text-[11px]">
                  <div className="flex justify-between gap-3 leading-snug">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-slate-400">{l.qty}×</span>{' '}
                      <span className="font-medium text-slate-900">{l.name}</span>
                    </div>
                    <span className="shrink-0 font-mono font-semibold tabular-nums text-slate-900">
                      {formatKES(l.unitPrice * l.qty)}
                    </span>
                  </div>
                  {isPhoneLine ? (
                    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-[9px] leading-relaxed text-slate-700 print:border-slate-300 print:bg-slate-50">
                      <p>
                        <span className="font-sans font-semibold text-slate-500">IMEI</span>{' '}
                        {l.imei?.trim() || '—'}
                      </p>
                      <p className="mt-0.5">
                        <span className="font-sans font-semibold text-slate-500">Serial</span>{' '}
                        {l.serialNumber?.trim() || '—'}
                      </p>
                      <p className="mt-0.5">
                        <span className="font-sans font-semibold text-slate-500">Warranty</span>{' '}
                        {l.warrantyMonths
                          ? `${l.warrantyMonths} mo${
                              l.warrantyExpiresAt
                                ? ` · ${new Date(l.warrantyExpiresAt).toLocaleDateString('en-KE')}`
                                : ''
                            }`
                          : '—'}
                      </p>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>

        {/* Total */}
        <section className="mt-5 border-t-2 border-slate-900 pt-3">
          <div className="flex items-baseline justify-between gap-2 font-sans">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-900">Total</span>
            <span className="font-mono text-lg font-bold tabular-nums text-slate-900">
              {formatKES(order.total)}
            </span>
          </div>
          {order.note ? (
            <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 font-sans text-[10px] text-slate-600 print:bg-slate-50">
              <span className="font-semibold text-slate-500">Note</span> {order.note}
            </p>
          ) : null}
        </section>

        {/* Footer */}
        <footer className="mt-6 border-t border-dashed border-slate-300 pt-4 text-center font-sans">
          <p className="text-[10px] font-medium text-slate-700">
            <span className="text-slate-400">WhatsApp</span> {SHOP.phone}
          </p>
          <p className="mt-1 break-all text-[10px] text-slate-600">{SHOP.email}</p>
          <p className="mt-4 text-[11px] font-semibold tracking-wide text-slate-900">Thank you</p>
        </footer>
      </article>
    </div>
  )
}

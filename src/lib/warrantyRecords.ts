import { addMonths, daysUntil, toISODateEndOfDay, warrantyStatus } from './warranty'
import { orderRefFromId } from './format'
import type { Order, WarrantyRecord } from '../types'

function resolveExpiresAt(o: Order, line: Order['lines'][0]): string | null {
  if (line.warrantyExpiresAt) return line.warrantyExpiresAt
  const m = line.warrantyMonths ?? 0
  if (!m) return null
  return toISODateEndOfDay(addMonths(new Date(o.createdAt), m))
}

/** Lines with a warranty window (phones / devices). */
export function buildWarrantyRecords(orders: Order[]): WarrantyRecord[] {
  const out: WarrantyRecord[] = []
  for (const o of orders) {
    if (o.status !== 'completed') continue
    const ref = orderRefFromId(o.id)
    o.lines.forEach((l, i) => {
      const months = l.warrantyMonths ?? 0
      if (!months) return
      const expiresAt = resolveExpiresAt(o, l)
      if (!expiresAt) return
      out.push({
        key: `${o.id}-${i}`,
        orderId: o.id,
        orderRef: ref,
        customerName: o.customerName ?? '—',
        customerId: o.customerId ?? '—',
        productName: l.name,
        imei: l.imei,
        serialNumber: l.serialNumber,
        purchasedAt: o.createdAt,
        warrantyMonths: months,
        expiresAt,
        orderStatus: o.status,
      })
    })
  }
  return out.sort(
    (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
  )
}

export function warrantyRowMeta(
  expiresAtISO: string,
  now = new Date(),
): { status: 'active' | 'expired'; daysLeft: number } {
  const st = warrantyStatus(expiresAtISO, now)
  const daysLeft = daysUntil(expiresAtISO, now)
  return { status: st, daysLeft }
}

export function exportWarrantiesCsv(rows: WarrantyRecord[]): string {
  const header = [
    'Order',
    'Customer',
    'Customer ID',
    'Product',
    'IMEI',
    'Serial',
    'Purchased',
    'Expires',
    'Warranty (months)',
    'Days remaining',
    'Status',
  ]
  const lines = rows.map((r) => {
    const { status, daysLeft } = warrantyRowMeta(r.expiresAt)
    return [
      r.orderRef,
      r.customerName.replace(/"/g, '""'),
      r.customerId.replace(/"/g, '""'),
      r.productName.replace(/"/g, '""'),
      r.imei ?? '',
      r.serialNumber ?? '',
      new Date(r.purchasedAt).toISOString(),
      new Date(r.expiresAt).toISOString(),
      String(r.warrantyMonths),
      String(daysLeft),
      status,
    ]
      .map((c) => `"${c}"`)
      .join(',')
  })
  return [header.join(','), ...lines].join('\r\n')
}

export function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

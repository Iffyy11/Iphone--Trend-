import type { Order } from '../types'

export interface CustomerSummary {
  key: string
  customerName: string
  customerId: string
  orders: Order[]
  totalSpent: number
  lastPurchase: string
}

export function summarizeCustomers(orders: Order[]): CustomerSummary[] {
  const map = new Map<string, CustomerSummary>()
  for (const o of orders) {
    if (o.status !== 'completed') continue
    const name = (o.customerName ?? '').trim() || '—'
    const id = (o.customerId ?? '').trim() || '—'
    const key = `${id.toLowerCase()}|${name.toLowerCase()}`
    const cur = map.get(key)
    if (!cur) {
      map.set(key, {
        key,
        customerName: name,
        customerId: id,
        orders: [o],
        totalSpent: o.total,
        lastPurchase: o.createdAt,
      })
    } else {
      cur.orders.push(o)
      cur.totalSpent += o.total
      if (new Date(o.createdAt) > new Date(cur.lastPurchase)) {
        cur.lastPurchase = o.createdAt
      }
    }
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.lastPurchase).getTime() - new Date(a.lastPurchase).getTime(),
  )
}

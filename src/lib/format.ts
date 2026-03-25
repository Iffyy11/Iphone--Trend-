const kes = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
})

export function formatKES(value: number): string {
  return kes.format(Math.round(value))
}

export function orderRefFromId(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

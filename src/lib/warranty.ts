/** Add calendar months to a date (approximate for month-end edge cases). */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime())
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  if (d.getDate() < day) d.setDate(0)
  return d
}

export function toISODateEndOfDay(d: Date): string {
  const x = new Date(d.getTime())
  x.setHours(23, 59, 59, 999)
  return x.toISOString()
}

export function daysUntil(targetISO: string, now = new Date()): number {
  const t = new Date(targetISO).getTime()
  const n = now.getTime()
  return Math.ceil((t - n) / (1000 * 60 * 60 * 24))
}

export function warrantyStatus(
  expiresAtISO: string,
  now = new Date(),
): 'active' | 'expired' {
  return new Date(expiresAtISO) >= now ? 'active' : 'expired'
}

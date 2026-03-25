export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

/** Last 7 days including today (start 00:00 six days ago). */
export function rangeLastWeek(now = new Date()): { start: Date; end: Date } {
  const start = startOfDay(new Date(now))
  start.setDate(start.getDate() - 6)
  return { start, end: endOfDay(now) }
}

/** Current calendar month from 1st through end of today. */
export function rangeThisMonth(now = new Date()): { start: Date; end: Date } {
  const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
  return { start, end: endOfDay(now) }
}

/** Current calendar year from Jan 1 through end of today. */
export function rangeThisYear(now = new Date()): { start: Date; end: Date } {
  const start = startOfDay(new Date(now.getFullYear(), 0, 1))
  return { start, end: endOfDay(now) }
}

export function rangeCustom(startStr: string, endStr: string): { start: Date; end: Date } | null {
  if (!startStr || !endStr) return null
  const a = startOfDay(new Date(startStr))
  const b = endOfDay(new Date(endStr))
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  if (a > b) return null
  return { start: a, end: b }
}

export function isOrderInRange(
  createdAtISO: string,
  start: Date,
  end: Date,
): boolean {
  const t = new Date(createdAtISO).getTime()
  return t >= start.getTime() && t <= end.getTime()
}

/** Presets for per-device warranty at checkout. */
export const WARRANTY_OPTIONS: { label: string; months: number }[] = [
  { label: 'No warranty', months: 0 },
  { label: '1 month', months: 1 },
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
  { label: '2 years', months: 24 },
  { label: '3 years', months: 36 },
  { label: '4 years', months: 48 },
]

export const DEFAULT_PHONE_WARRANTY_MONTHS = 3

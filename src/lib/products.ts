import type { Product } from '../types'

export function isAccessoryProduct(p: Pick<Product, 'category'>): boolean {
  return p.category === 'Accessories'
}

export type ProductParts = {
  model: string
  storage?: string
  sim?: string
  colour?: string
}

/** Splits names like "iPhone 17 Pro Max 512GB (physical SIM) · Silver" into display parts. */
export function describeProduct(name: string): ProductParts {
  const [main, colour] = name.split(' · ')
  const storage = main.match(/\b\d+\s?(GB|TB)\b/i)?.[0]
  const sim = main.match(/\(([^)]+)\)/)?.[1]
  const model = main
    .replace(/\b\d+\s?(GB|TB)\b/i, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return { model: model || name, storage, sim, colour: colour?.trim() }
}

const COLOUR_SWATCHES: Record<string, string> = {
  silver: '#d4d4d8',
  orange: '#f97316',
  blue: '#3b82f6',
  black: '#18181b',
  white: '#fafafa',
  gold: '#d4a24c',
  green: '#22c55e',
  pink: '#f9a8d4',
  purple: '#a78bfa',
  red: '#ef4444',
}

/** First recognised colour word → swatch hex (e.g. "Blue / Orange" → blue). */
export function colourSwatch(colour: string): string | undefined {
  const word = colour.toLowerCase().match(/[a-z]+/g)?.find((w) => w in COLOUR_SWATCHES)
  return word ? COLOUR_SWATCHES[word] : undefined
}

import type { Product } from '../types'

export function isAccessoryProduct(p: Pick<Product, 'category'>): boolean {
  return p.category === 'Accessories'
}

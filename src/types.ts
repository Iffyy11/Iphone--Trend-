export type UserRole = 'cashier' | 'admin'

export interface AdminAccount {
  email: string
  salt: string
  passwordHash: string
}

export interface CashierAccount {
  id: string
  name: string
  pinSalt: string
  pinHash: string
  /** Plain PIN for admin reference only (stored on this device). */
  pinPlain?: string
}

export type PaymentMethod = 'cash' | 'mpesa' | 'card' | 'other'

export interface Product {
  id: string
  name: string
  price: number
  category: string
  active: boolean
}

export interface OrderLine {
  productId: string
  name: string
  qty: number
  unitPrice: number
  /** Device IMEI (phones / tracked devices). */
  imei?: string
  /** Device serial number. */
  serialNumber?: string
  /** Warranty length in months (0 = none). */
  warrantyMonths?: number
  /** ISO date when warranty ends (set at sale time). */
  warrantyExpiresAt?: string
}

export interface Order {
  id: string
  createdAt: string
  lines: OrderLine[]
  total: number
  role: UserRole
  staffLabel: string
  paymentMethod: PaymentMethod
  status: 'completed' | 'void'
  /** Customer full name (optional on legacy records) */
  customerName?: string
  /** National ID or passport (optional on legacy records) */
  customerId?: string
  note?: string
}

/** For admin warranty / customer views */
export interface WarrantyRecord {
  key: string
  orderId: string
  orderRef: string
  customerName: string
  customerId: string
  productName: string
  imei?: string
  serialNumber?: string
  purchasedAt: string
  warrantyMonths: number
  expiresAt: string
  orderStatus: Order['status']
}

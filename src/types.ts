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
  /** Purchase cost per unit, used for gross-profit reporting when known. */
  costPrice?: number
  category: string
  active: boolean
}

export interface OrderLine {
  productId: string
  name: string
  qty: number
  unitPrice: number
  /** Cost per unit captured at checkout for historical profit reporting. */
  unitCost?: number
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
  /** Sum of line prices before discount or trade-in credit. */
  subtotal?: number
  /** Discount in KSh taken off the subtotal. */
  discount?: number
  /** Accepted trade-in value applied as credit to the sale. */
  tradeInValue?: number
  tradeInDevice?: string
  /** Amount actually charged (subtotal − discount − trade-in credit). */
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

export type SupplierRecordKind = 'credit' | 'consignment'

export interface SupplierRecord {
  id: string
  kind: SupplierRecordKind
  supplier: string
  product: string
  quantity: number
  unitCost: number
  receivedAt: string
  dueDate?: string
  unitsSold: number
  settledAmount: number
  note?: string
}

export interface ExpenseRecord {
  id: string
  date: string
  category: string
  description: string
  amount: number
  vatRate: number
}

export interface BusinessInvoice {
  id: string
  number: string
  customer: string
  issuedAt: string
  dueDate?: string
  amount: number
  paidAmount: number
  note?: string
}

export interface TradeInRecord {
  id: string
  receivedAt: string
  customer: string
  device: string
  imei?: string
  condition: string
  value: number
  saleReference?: string
  note?: string
}

export interface VatRecord {
  id: string
  date: string
  kind: 'output' | 'input'
  reference: string
  taxableAmount: number
  vatRate: number
}

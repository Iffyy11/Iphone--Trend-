import {
  BarChart3,
  KeyRound,
  Package,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'

export type AdminTab = 'overview' | 'orders' | 'trade-ins' | 'customers' | 'warranties' | 'products' | 'staff' | 'finance'

export const ADMIN_SECTIONS: {
  key: AdminTab
  label: string
  description: string
  icon: LucideIcon
}[] = [
  { key: 'overview', label: 'Overview', description: 'Sales and shop performance at a glance', icon: BarChart3 },
  { key: 'orders', label: 'Sales', description: 'Review sales, receipts and voided transactions', icon: ShoppingCart },
  { key: 'trade-ins', label: 'Trade-ins', description: 'View devices received through trade-ins and their linked sales', icon: RefreshCw },
  { key: 'customers', label: 'Customers', description: 'Purchase history per customer', icon: Users },
  { key: 'warranties', label: 'Warranties', description: 'Devices under cover and expiry dates', icon: ShieldCheck },
  { key: 'products', label: 'Products', description: 'Catalogue, prices and shelf status', icon: Package },
  { key: 'staff', label: 'Staff', description: 'Cashier PINs and the admin account', icon: KeyRound },
  { key: 'finance', label: 'Finance', description: 'Supplier balances, expenses, invoices and trade-ins', icon: WalletCards },
]

export function parseAdminTab(raw: string | null): AdminTab {
  return ADMIN_SECTIONS.some((s) => s.key === raw) ? (raw as AdminTab) : 'overview'
}

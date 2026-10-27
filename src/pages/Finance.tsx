import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Plus,
  Receipt,
  Wallet,
} from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { formatKES } from '../lib/format'
import { usePosStore } from '../store/posStore'
import type { SupplierRecordKind } from '../types'

type FinanceView = 'summary' | 'suppliers' | 'expenses' | 'invoices' | 'trade-ins' | 'vat'

const VIEWS: { id: FinanceView; label: string }[] = [
  { id: 'summary', label: 'Profit & reports' },
  { id: 'suppliers', label: 'Suppliers & stock' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'trade-ins', label: 'Trade-ins' },
  { id: 'vat', label: 'VAT records' },
]

function todayDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function dateLabel(date: string) {
  if (!date) return '—'
  return new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-KE')
}

function amount(raw: string) {
  return Number(raw.replace(/,/g, '').trim())
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  )
}

function Metric({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string
  value: string
  detail: string
  icon: typeof Wallet
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">{title}</p>
        <Icon className="h-4 w-4 text-accent" aria-hidden />
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-fg-muted">{detail}</p>
    </div>
  )
}

export function Finance() {
  const orders = usePosStore((s) => s.orders)
  const suppliers = usePosStore((s) => s.supplierRecords)
  const expenses = usePosStore((s) => s.expenses)
  const invoices = usePosStore((s) => s.invoices)
  const tradeIns = usePosStore((s) => s.tradeIns)
  const vatRecords = usePosStore((s) => s.vatRecords)
  const addSupplierRecord = usePosStore((s) => s.addSupplierRecord)
  const updateSupplierUnitsSold = usePosStore((s) => s.updateSupplierUnitsSold)
  const addSupplierSettlement = usePosStore((s) => s.addSupplierSettlement)
  const addExpense = usePosStore((s) => s.addExpense)
  const addInvoice = usePosStore((s) => s.addInvoice)
  const addInvoicePayment = usePosStore((s) => s.addInvoicePayment)
  const addTradeIn = usePosStore((s) => s.addTradeIn)
  const addVatRecord = usePosStore((s) => s.addVatRecord)

  const [view, setView] = useState<FinanceView>('summary')
  const [message, setMessage] = useState('')
  const [supplierKind, setSupplierKind] = useState<SupplierRecordKind>('credit')
  const [supplier, setSupplier] = useState('')
  const [supplierProduct, setSupplierProduct] = useState('')
  const [supplierQty, setSupplierQty] = useState('')
  const [supplierCost, setSupplierCost] = useState('')
  const [supplierReceived, setSupplierReceived] = useState(todayDate())
  const [supplierDue, setSupplierDue] = useState('')
  const [supplierNote, setSupplierNote] = useState('')
  const [expenseDate, setExpenseDate] = useState(todayDate())
  const [expenseCategory, setExpenseCategory] = useState('')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseVatRate, setExpenseVatRate] = useState('0')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceCustomer, setInvoiceCustomer] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(todayDate())
  const [invoiceDue, setInvoiceDue] = useState('')
  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [invoiceNote, setInvoiceNote] = useState('')
  const [tradeDate, setTradeDate] = useState(todayDate())
  const [tradeCustomer, setTradeCustomer] = useState('')
  const [tradeDevice, setTradeDevice] = useState('')
  const [tradeImei, setTradeImei] = useState('')
  const [tradeCondition, setTradeCondition] = useState('Good')
  const [tradeValue, setTradeValue] = useState('')
  const [tradeSale, setTradeSale] = useState('')
  const [tradeNote, setTradeNote] = useState('')
  const [vatDate, setVatDate] = useState(todayDate())
  const [vatKind, setVatKind] = useState<'output' | 'input'>('output')
  const [vatReference, setVatReference] = useState('')
  const [vatBase, setVatBase] = useState('')
  const [vatRate, setVatRate] = useState('16')
  const [settlementDrafts, setSettlementDrafts] = useState<Record<string, string>>({})
  const [invoicePaymentDrafts, setInvoicePaymentDrafts] = useState<Record<string, string>>({})

  const completedOrders = useMemo(
    () => orders.filter((order) => order.status === 'completed'),
    [orders],
  )
  const revenue = completedOrders.reduce((sum, order) => {
    const subtotal = order.subtotal ?? order.lines.reduce((lineSum, line) => lineSum + line.unitPrice * line.qty, 0)
    const salesAfterDiscount = Math.max(0, subtotal - (order.discount ?? 0))
    const embeddedVat = order.vatInclusive ? order.vatAmount ?? 0 : 0
    return sum + salesAfterDiscount - embeddedVat
  }, 0)
  const costReport = useMemo(() => {
    let knownCost = 0
    let uncostedUnits = 0
    for (const order of completedOrders) {
      for (const line of order.lines) {
        if (line.unitCost === undefined) {
          uncostedUnits += line.qty
          continue
        }
        knownCost += line.unitCost * line.qty
      }
    }
    return { knownCost, uncostedUnits }
  }, [completedOrders])
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0)
  const grossProfit = revenue - costReport.knownCost
  const netProfit = grossProfit - totalExpenses
  const supplierBalance = suppliers.reduce((sum, record) => {
    const dueUnits = record.kind === 'credit' ? record.quantity : record.unitsSold
    return sum + Math.max(0, dueUnits * record.unitCost - record.settledAmount)
  }, 0)
  const outstandingInvoices = invoices.reduce(
    (sum, invoice) => sum + Math.max(0, invoice.amount - invoice.paidAmount),
    0,
  )
  const outputVat = vatRecords
    .filter((record) => record.kind === 'output')
    .reduce((sum, record) => sum + record.taxableAmount * record.vatRate / 100, 0)
  const inputVat = vatRecords
    .filter((record) => record.kind === 'input')
    .reduce((sum, record) => sum + record.taxableAmount * record.vatRate / 100, 0)

  function submit(event: FormEvent<HTMLFormElement>, save: () => void) {
    event.preventDefault()
    setMessage('')
    save()
  }

  function saveSupplier(event: FormEvent<HTMLFormElement>) {
    submit(event, () => {
      const qty = amount(supplierQty)
      const cost = amount(supplierCost)
      if (!supplier.trim() || !supplierProduct.trim() || !Number.isInteger(qty) || qty < 1 || !Number.isFinite(cost) || cost < 0 || !supplierReceived) {
        setMessage('Enter a supplier, product, valid quantity, unit cost and received date.')
        return
      }
      addSupplierRecord({
        kind: supplierKind,
        supplier: supplier.trim(),
        product: supplierProduct.trim(),
        quantity: qty,
        unitCost: Math.round(cost),
        receivedAt: supplierReceived,
        dueDate: supplierDue || undefined,
        note: supplierNote.trim() || undefined,
      })
      setSupplier('')
      setSupplierProduct('')
      setSupplierQty('')
      setSupplierCost('')
      setSupplierDue('')
      setSupplierNote('')
      setMessage('Stock record saved.')
    })
  }

  function saveExpense(event: FormEvent<HTMLFormElement>) {
    submit(event, () => {
      const value = amount(expenseAmount)
      const rate = amount(expenseVatRate)
      if (!expenseDate || !expenseCategory.trim() || !expenseDescription.trim() || !Number.isFinite(value) || value <= 0 || !Number.isFinite(rate) || rate < 0 || rate > 100) {
        setMessage('Enter a valid date, category, description, amount and VAT rate (0–100%).')
        return
      }
      addExpense({
        date: expenseDate,
        category: expenseCategory.trim(),
        description: expenseDescription.trim(),
        amount: Math.round(value),
        vatRate: rate,
      })
      setExpenseCategory('')
      setExpenseDescription('')
      setExpenseAmount('')
      setExpenseVatRate('0')
      setMessage('Expense recorded.')
    })
  }

  function saveInvoice(event: FormEvent<HTMLFormElement>) {
    submit(event, () => {
      const value = amount(invoiceAmount)
      if (!invoiceNumber.trim() || !invoiceCustomer.trim() || !invoiceDate || !Number.isFinite(value) || value <= 0) {
        setMessage('Enter an invoice number, customer, issue date and positive amount.')
        return
      }
      addInvoice({
        number: invoiceNumber.trim(),
        customer: invoiceCustomer.trim(),
        issuedAt: invoiceDate,
        dueDate: invoiceDue || undefined,
        amount: Math.round(value),
        note: invoiceNote.trim() || undefined,
      })
      setInvoiceNumber('')
      setInvoiceCustomer('')
      setInvoiceDue('')
      setInvoiceAmount('')
      setInvoiceNote('')
      setMessage('Invoice recorded.')
    })
  }

  function saveTradeIn(event: FormEvent<HTMLFormElement>) {
    submit(event, () => {
      const value = amount(tradeValue)
      if (!tradeCustomer.trim() || !tradeDevice.trim() || !tradeCondition.trim() || !Number.isFinite(value) || value <= 0 || !tradeDate) {
        setMessage('Enter a customer, device, condition, date and positive trade-in value.')
        return
      }
      addTradeIn({
        receivedAt: tradeDate,
        customer: tradeCustomer.trim(),
        device: tradeDevice.trim(),
        imei: tradeImei.trim() || undefined,
        condition: tradeCondition,
        value: Math.round(value),
        saleReference: tradeSale.trim() || undefined,
        note: tradeNote.trim() || undefined,
      })
      setTradeCustomer('')
      setTradeDevice('')
      setTradeImei('')
      setTradeValue('')
      setTradeSale('')
      setTradeNote('')
      setMessage('Trade-in recorded.')
    })
  }

  function saveVat(event: FormEvent<HTMLFormElement>) {
    submit(event, () => {
      const base = amount(vatBase)
      const rate = amount(vatRate)
      if (!vatDate || !vatReference.trim() || !Number.isFinite(base) || base < 0 || !Number.isFinite(rate) || rate < 0 || rate > 100) {
        setMessage('Enter a valid date, reference, taxable amount and VAT rate (0–100%).')
        return
      }
      addVatRecord({
        date: vatDate,
        kind: vatKind,
        reference: vatReference.trim(),
        taxableAmount: Math.round(base),
        vatRate: rate,
      })
      setVatReference('')
      setVatBase('')
      setMessage('VAT record saved.')
    })
  }

  const forms = {
    suppliers: (
      <form onSubmit={saveSupplier} className="grid gap-3 border-b border-line p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Record type">
          <select value={supplierKind} onChange={(e) => setSupplierKind(e.target.value as SupplierRecordKind)} className="input">
            <option value="credit">Supplier credit</option>
            <option value="consignment">Consignment stock</option>
          </select>
        </Field>
        <Field label="Supplier"><input required value={supplier} onChange={(e) => setSupplier(e.target.value)} className="input" /></Field>
        <Field label="Product / stock"><input required value={supplierProduct} onChange={(e) => setSupplierProduct(e.target.value)} className="input" /></Field>
        <Field label="Units received"><input required type="number" min="1" step="1" value={supplierQty} onChange={(e) => setSupplierQty(e.target.value)} className="input" /></Field>
        <Field label="Cost per unit (KSh)"><input required type="number" min="0" step="1" value={supplierCost} onChange={(e) => setSupplierCost(e.target.value)} className="input" /></Field>
        <Field label="Received on"><input required type="date" value={supplierReceived} onChange={(e) => setSupplierReceived(e.target.value)} className="input" /></Field>
        <Field label="Due date (optional)"><input type="date" value={supplierDue} onChange={(e) => setSupplierDue(e.target.value)} className="input" /></Field>
        <Field label="Note (optional)"><input value={supplierNote} onChange={(e) => setSupplierNote(e.target.value)} className="input" /></Field>
        <div className="sm:col-span-2 lg:col-span-4"><button className="btn-primary" type="submit"><Plus className="h-4 w-4" /> Record stock</button></div>
      </form>
    ),
    expenses: (
      <form onSubmit={saveExpense} className="grid gap-3 border-b border-line p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Date"><input required type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="input" /></Field>
        <Field label="Category"><input required value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} placeholder="Rent, utilities, transport…" className="input" /></Field>
        <Field label="Description"><input required value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} className="input" /></Field>
        <Field label="Amount (KSh)"><input required type="number" min="1" step="1" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} className="input" /></Field>
        <Field label="VAT rate (%)"><input required type="number" min="0" max="100" step="0.01" value={expenseVatRate} onChange={(e) => setExpenseVatRate(e.target.value)} className="input" /></Field>
        <div className="flex items-end"><button className="btn-primary" type="submit"><Plus className="h-4 w-4" /> Add expense</button></div>
      </form>
    ),
    invoices: (
      <form onSubmit={saveInvoice} className="grid gap-3 border-b border-line p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Invoice number"><input required value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="input" /></Field>
        <Field label="Customer"><input required value={invoiceCustomer} onChange={(e) => setInvoiceCustomer(e.target.value)} className="input" /></Field>
        <Field label="Issue date"><input required type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="input" /></Field>
        <Field label="Due date"><input type="date" value={invoiceDue} onChange={(e) => setInvoiceDue(e.target.value)} className="input" /></Field>
        <Field label="Invoice total (KSh)"><input required type="number" min="1" step="1" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} className="input" /></Field>
        <Field label="Note (optional)"><input value={invoiceNote} onChange={(e) => setInvoiceNote(e.target.value)} className="input" /></Field>
        <div><button className="btn-primary" type="submit"><Plus className="h-4 w-4" /> Record invoice</button></div>
      </form>
    ),
    'trade-ins': (
      <form onSubmit={saveTradeIn} className="grid gap-3 border-b border-line p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Received on"><input required type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} className="input" /></Field>
        <Field label="Customer"><input required value={tradeCustomer} onChange={(e) => setTradeCustomer(e.target.value)} className="input" /></Field>
        <Field label="Device"><input required value={tradeDevice} onChange={(e) => setTradeDevice(e.target.value)} placeholder="Model / storage / colour" className="input" /></Field>
        <Field label="IMEI (optional)"><input value={tradeImei} onChange={(e) => setTradeImei(e.target.value)} className="input font-mono" /></Field>
        <Field label="Condition">
          <select value={tradeCondition} onChange={(e) => setTradeCondition(e.target.value)} className="input">
            {['Excellent', 'Good', 'Fair', 'Poor', 'For parts'].map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Agreed value (KSh)"><input required type="number" min="1" step="1" value={tradeValue} onChange={(e) => setTradeValue(e.target.value)} className="input" /></Field>
        <Field label="Related sale / receipt (optional)"><input value={tradeSale} onChange={(e) => setTradeSale(e.target.value)} className="input" /></Field>
        <Field label="Note (optional)"><input value={tradeNote} onChange={(e) => setTradeNote(e.target.value)} className="input" /></Field>
        <div className="flex items-end"><button className="btn-primary" type="submit"><Plus className="h-4 w-4" /> Record trade-in</button></div>
      </form>
    ),
    vat: (
      <form onSubmit={saveVat} className="grid gap-3 border-b border-line p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Date"><input required type="date" value={vatDate} onChange={(e) => setVatDate(e.target.value)} className="input" /></Field>
        <Field label="VAT type">
          <select value={vatKind} onChange={(e) => setVatKind(e.target.value as 'output' | 'input')} className="input">
            <option value="output">Output VAT · sales</option>
            <option value="input">Input VAT · purchases</option>
          </select>
        </Field>
        <Field label="Receipt / invoice reference"><input required value={vatReference} onChange={(e) => setVatReference(e.target.value)} className="input" /></Field>
        <Field label="Taxable amount before VAT (KSh)"><input required type="number" min="0" step="1" value={vatBase} onChange={(e) => setVatBase(e.target.value)} className="input" /></Field>
        <Field label="VAT rate (%)"><input required type="number" min="0" max="100" step="0.01" value={vatRate} onChange={(e) => setVatRate(e.target.value)} className="input" /></Field>
        <div className="flex items-end"><button className="btn-primary" type="submit"><Plus className="h-4 w-4" /> Add VAT record</button></div>
      </form>
    ),
  }

  function supplierOutstanding(record: (typeof suppliers)[number]) {
    const dueUnits = record.kind === 'credit' ? record.quantity : record.unitsSold
    return Math.max(0, dueUnits * record.unitCost - record.settledAmount)
  }

  const supplierTable = (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="table-head"><tr>
          <th className="px-5 py-3">Type / supplier</th><th className="px-5 py-3">Product</th>
          <th className="px-5 py-3">Received / due</th><th className="px-5 py-3">Units</th>
          <th className="px-5 py-3">Obligation</th><th className="px-5 py-3">Settled</th><th className="px-5 py-3">Balance / action</th>
        </tr></thead>
        <tbody className="divide-y divide-line">
          {suppliers.length === 0 ? <tr><td colSpan={7} className="px-5 py-8 text-center text-fg-muted">No supplier stock records yet.</td></tr> : suppliers.map((record) => {
            const balance = supplierOutstanding(record)
            const obligation = (record.kind === 'credit' ? record.quantity : record.unitsSold) * record.unitCost
            return <tr key={record.id}>
              <td className="px-5 py-3"><p className="font-medium">{record.supplier}</p><span className="badge-neutral capitalize">{record.kind}</span></td>
              <td className="px-5 py-3">{record.product}<p className="text-xs text-fg-muted">{formatKES(record.unitCost)} each</p></td>
              <td className="px-5 py-3 text-xs text-fg-muted">{dateLabel(record.receivedAt)}{record.dueDate ? <p>Due {dateLabel(record.dueDate)}</p> : null}</td>
              <td className="px-5 py-3">
                {record.kind === 'consignment' ? <label className="text-xs text-fg-muted">Sold <input aria-label={`Units sold for ${record.product}`} type="number" min={Math.ceil(record.settledAmount / (record.unitCost || 1))} max={record.quantity} step="1" value={record.unitsSold} onChange={(e) => updateSupplierUnitsSold(record.id, Number(e.target.value))} className="input ml-1 w-20 px-2 py-1" /> / {record.quantity}</label> : `${record.quantity} received`}
              </td>
              <td className="px-5 py-3 tabular-nums">{formatKES(obligation)}</td><td className="px-5 py-3 tabular-nums">{formatKES(record.settledAmount)}</td>
              <td className="px-5 py-3">
                <p className={`font-semibold tabular-nums ${balance ? 'text-warning' : 'text-success'}`}>{formatKES(balance)}</p>
                {balance > 0 ? <form className="mt-2 flex gap-1" onSubmit={(e) => {
                  e.preventDefault()
                  const value = amount(settlementDrafts[record.id] ?? '')
                  if (!Number.isFinite(value) || value <= 0 || value > balance) {
                    setMessage('Settlement must be greater than zero and no more than the outstanding balance.')
                    return
                  }
                  addSupplierSettlement(record.id, Math.round(value))
                  setSettlementDrafts((drafts) => ({ ...drafts, [record.id]: '' }))
                }}>
                  <input aria-label={`Settlement amount for ${record.supplier}`} type="number" min="1" max={balance} step="1" value={settlementDrafts[record.id] ?? ''} onChange={(e) => setSettlementDrafts((drafts) => ({ ...drafts, [record.id]: e.target.value }))} placeholder="Amount" className="input w-28 px-2 py-1" />
                  <button type="submit" className="btn-secondary px-2 py-1 text-xs">Settle</button>
                </form> : null}
              </td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
  )

  const invoiceTable = (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="table-head"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Issued / due</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Paid</th><th className="px-5 py-3">Balance / payment</th></tr></thead>
        <tbody className="divide-y divide-line">
          {invoices.length === 0 ? <tr><td colSpan={6} className="px-5 py-8 text-center text-fg-muted">No invoices recorded yet.</td></tr> : invoices.map((invoice) => {
            const balance = Math.max(0, invoice.amount - invoice.paidAmount)
            return <tr key={invoice.id}>
              <td className="px-5 py-3 font-medium">{invoice.number}{invoice.note ? <p className="text-xs font-normal text-fg-muted">{invoice.note}</p> : null}</td>
              <td className="px-5 py-3">{invoice.customer}</td><td className="px-5 py-3 text-xs text-fg-muted">{dateLabel(invoice.issuedAt)}{invoice.dueDate ? <p>Due {dateLabel(invoice.dueDate)}</p> : null}</td>
              <td className="px-5 py-3 tabular-nums">{formatKES(invoice.amount)}</td><td className="px-5 py-3 tabular-nums">{formatKES(invoice.paidAmount)}</td>
              <td className="px-5 py-3"><p className={`font-semibold tabular-nums ${balance ? 'text-warning' : 'text-success'}`}>{formatKES(balance)}</p>
                {balance > 0 ? <form className="mt-2 flex gap-1" onSubmit={(e) => {
                  e.preventDefault()
                  const value = amount(invoicePaymentDrafts[invoice.id] ?? '')
                  if (!Number.isFinite(value) || value <= 0 || value > balance) {
                    setMessage('Invoice payment must be greater than zero and no more than the balance.')
                    return
                  }
                  addInvoicePayment(invoice.id, Math.round(value))
                  setInvoicePaymentDrafts((drafts) => ({ ...drafts, [invoice.id]: '' }))
                }}>
                  <input aria-label={`Payment amount for invoice ${invoice.number}`} type="number" min="1" max={balance} step="1" value={invoicePaymentDrafts[invoice.id] ?? ''} onChange={(e) => setInvoicePaymentDrafts((drafts) => ({ ...drafts, [invoice.id]: e.target.value }))} placeholder="Amount" className="input w-28 px-2 py-1" />
                  <button type="submit" className="btn-secondary px-2 py-1 text-xs">Record</button>
                </form> : null}
              </td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="space-y-5">
      <nav aria-label="Finance sections" className="flex gap-2 overflow-x-auto pb-1">
        {VIEWS.map((item) => (
          <button key={item.id} type="button" onClick={() => { setView(item.id); setMessage('') }} aria-current={view === item.id ? 'page' : undefined} className={view === item.id ? 'btn-primary whitespace-nowrap' : 'btn-secondary whitespace-nowrap'}>
            {item.label}
          </button>
        ))}
      </nav>
      {message ? <p role="status" className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-fg">{message}</p> : null}

      {view === 'summary' ? <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Sales revenue" value={formatKES(revenue)} detail={`${completedOrders.length} completed sales · all time`} icon={ArrowUpRight} />
          <Metric title="Known product costs" value={formatKES(costReport.knownCost)} detail={costReport.uncostedUnits ? `${costReport.uncostedUnits} sold units have no saved cost` : 'Cost captured for all recorded sales'} icon={ArrowDownLeft} />
          <Metric title="Operating expenses" value={formatKES(totalExpenses)} detail={`${expenses.length} expense records`} icon={Receipt} />
          <Metric title="Estimated net profit" value={formatKES(netProfit)} detail="Sales less known product costs and expenses" icon={Banknote} />
        </div>
        {costReport.uncostedUnits ? <p className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-fg-muted">Profit is an estimate and excludes product cost for {costReport.uncostedUnits} sold unit(s). Add purchase costs in Products; older sales without a cost snapshot remain uncosted.</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard title="Supplier balances" description="Unsettled supplier credit and sold consignment stock">
            <div className="p-5"><p className="text-2xl font-semibold tabular-nums">{formatKES(supplierBalance)}</p><p className="mt-1 text-sm text-fg-muted">{suppliers.length} stock records</p></div>
          </SectionCard>
          <SectionCard title="Accounts receivable" description="Outstanding customer invoice amounts">
            <div className="p-5"><p className="text-2xl font-semibold tabular-nums">{formatKES(outstandingInvoices)}</p><p className="mt-1 text-sm text-fg-muted">{invoices.filter((invoice) => invoice.amount > invoice.paidAmount).length} unpaid or partial invoices</p></div>
          </SectionCard>
        </div>
        <SectionCard title="VAT position" description="Calculated from VAT records entered below; rates are set per record.">
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <div><p className="eyebrow">Output VAT</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatKES(outputVat)}</p></div>
            <div><p className="eyebrow">Input VAT</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatKES(inputVat)}</p></div>
            <div><p className="eyebrow">Net VAT (output − input)</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatKES(outputVat - inputVat)}</p></div>
          </div>
        </SectionCard>
      </> : null}

      {view === 'suppliers' ? <SectionCard title="Supplier credit & consignment" description="Credit is payable on all received units; consignment is payable only as units are marked sold. Settlements cannot exceed the current obligation.">
        {forms.suppliers}{supplierTable}
      </SectionCard> : null}
      {view === 'expenses' ? <SectionCard title="Operating expenses" description="Expense VAT rate is recorded for reference; VAT return totals are based on VAT records.">
        {forms.expenses}
        <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm">
          <thead className="table-head"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Category / description</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">VAT rate</th></tr></thead>
          <tbody className="divide-y divide-line">{expenses.length === 0 ? <tr><td colSpan={4} className="px-5 py-8 text-center text-fg-muted">No expenses recorded yet.</td></tr> : expenses.map((expense) => <tr key={expense.id}><td className="px-5 py-3">{dateLabel(expense.date)}</td><td className="px-5 py-3"><p className="font-medium">{expense.category}</p><p className="text-xs text-fg-muted">{expense.description}</p></td><td className="px-5 py-3 font-semibold tabular-nums">{formatKES(expense.amount)}</td><td className="px-5 py-3">{expense.vatRate}%</td></tr>)}</tbody>
        </table></div>
      </SectionCard> : null}
      {view === 'invoices' ? <SectionCard title="Business invoices" description="Record invoice balances and capture full or partial customer payments.">
        {forms.invoices}{invoiceTable}
      </SectionCard> : null}
      {view === 'trade-ins' ? <SectionCard title="Trade-in register" description="Record accepted devices, condition, agreed value and optional related sale reference.">
        {forms['trade-ins']}
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
          <thead className="table-head"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Device / IMEI</th><th className="px-5 py-3">Condition</th><th className="px-5 py-3">Value</th><th className="px-5 py-3">Sale reference</th></tr></thead>
          <tbody className="divide-y divide-line">{tradeIns.length === 0 ? <tr><td colSpan={6} className="px-5 py-8 text-center text-fg-muted">No trade-ins recorded yet.</td></tr> : tradeIns.map((trade) => <tr key={trade.id}><td className="px-5 py-3">{dateLabel(trade.receivedAt)}</td><td className="px-5 py-3 font-medium">{trade.customer}</td><td className="px-5 py-3">{trade.device}{trade.imei ? <p className="font-mono text-xs text-fg-muted">{trade.imei}</p> : null}</td><td className="px-5 py-3">{trade.condition}</td><td className="px-5 py-3 font-semibold tabular-nums">{formatKES(trade.value)}</td><td className="px-5 py-3">{trade.saleReference || '—'}</td></tr>)}</tbody>
        </table></div>
      </SectionCard> : null}
      {view === 'vat' ? <SectionCard title="VAT records" description="VAT-enabled receipts create output VAT records automatically. You can also enter records manually; taxable amounts are exclusive of VAT.">
        {forms.vat}
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
          <thead className="table-head"><tr><th className="px-5 py-3">Date / reference</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Taxable amount</th><th className="px-5 py-3">Rate</th><th className="px-5 py-3">VAT amount</th></tr></thead>
          <tbody className="divide-y divide-line">{vatRecords.length === 0 ? <tr><td colSpan={5} className="px-5 py-8 text-center text-fg-muted">No VAT records entered yet.</td></tr> : vatRecords.map((record) => <tr key={record.id}><td className="px-5 py-3">{dateLabel(record.date)}<p className="text-xs text-fg-muted">{record.reference}</p></td><td className="px-5 py-3"><span className="inline-flex items-center gap-1.5 capitalize">{record.kind === 'output' ? <ArrowUpRight className="h-4 w-4 text-success" /> : <ArrowDownLeft className="h-4 w-4 text-accent" />}{record.kind}</span></td><td className="px-5 py-3 tabular-nums">{formatKES(record.taxableAmount)}</td><td className="px-5 py-3">{record.vatRate}%</td><td className="px-5 py-3 font-semibold tabular-nums">{formatKES(record.taxableAmount * record.vatRate / 100)}</td></tr>)}</tbody>
        </table></div>
      </SectionCard> : null}
      <p className="text-xs text-fg-subtle">Records are stored with this POS data on this device. Reports use all recorded dates and are operational summaries, not tax filings.</p>
    </div>
  )
}

import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Download,
  FileSpreadsheet,
  Plus,
  Receipt,
  Wallet,
} from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { formatKES } from '../lib/format'
import { usePosStore } from '../store/posStore'

type SupplierDeviceDraft = {
  imei: string
  imei2: string
  serialNumber: string
  color: string
  storage: string
  batteryHealth: string
  condition: string
}

function emptySupplierDevice(): SupplierDeviceDraft {
  return {
    imei: '',
    imei2: '',
    serialNumber: '',
    color: '',
    storage: '',
    batteryHealth: '',
    condition: '',
  }
}

type FinanceView = 'summary' | 'suppliers' | 'stock' | 'expenses' | 'invoices' | 'trade-ins'

const VIEWS: { id: FinanceView; label: string }[] = [
  { id: 'summary', label: 'Profit & reports' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'stock', label: 'Stock' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'trade-ins', label: 'Trade-ins' },
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
  const supplierRecords = usePosStore((s) => s.supplierRecords)
  const supplierPayments = usePosStore((s) => s.supplierPayments)
  const savedSupplierNames = usePosStore((s) => s.suppliers)
  const expenses = usePosStore((s) => s.expenses)
  const invoices = usePosStore((s) => s.invoices)
  const tradeIns = usePosStore((s) => s.tradeIns)
  const addSupplier = usePosStore((s) => s.addSupplier)
  const addSupplierRecord = usePosStore((s) => s.addSupplierRecord)
  const addSupplierSettlement = usePosStore((s) => s.addSupplierSettlement)
  const addExpense = usePosStore((s) => s.addExpense)
  const addInvoice = usePosStore((s) => s.addInvoice)
  const addInvoicePayment = usePosStore((s) => s.addInvoicePayment)
  const addTradeIn = usePosStore((s) => s.addTradeIn)

  const [view, setView] = useState<FinanceView>('summary')
  const [message, setMessage] = useState('')
  const [supplier, setSupplier] = useState('')
  const [newSupplierName, setNewSupplierName] = useState('')
  const [supplierProduct, setSupplierProduct] = useState('')
  const [supplierQty, setSupplierQty] = useState('')
  const [supplierCost, setSupplierCost] = useState('')
  const [supplierReceived, setSupplierReceived] = useState(todayDate())
  const [supplierDue, setSupplierDue] = useState('')
  const [supplierNote, setSupplierNote] = useState('')
  const [supplierDeviceDrafts, setSupplierDeviceDrafts] = useState<SupplierDeviceDraft[]>([])
  const [supplierPaymentDraft, setSupplierPaymentDraft] = useState('')
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
  const [invoicePaymentDrafts, setInvoicePaymentDrafts] = useState<Record<string, string>>({})

  const completedOrders = useMemo(
    () => orders.filter((order) => order.status === 'completed'),
    [orders],
  )
  const supplierNames = useMemo(
    () => [...new Set([
      ...savedSupplierNames,
      ...supplierRecords.map((record) => record.supplier),
    ])].sort((a, b) => a.localeCompare(b)),
    [savedSupplierNames, supplierRecords],
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
  const supplierBalance = supplierRecords.reduce((sum, record) => {
    const dueUnits = record.kind === 'consignment' ? record.unitsSold : record.quantity
    return sum + Math.max(0, dueUnits * record.unitCost - record.settledAmount)
  }, 0)
  const supplierBalances = supplierNames.map((name) => ({
    name,
    balance: supplierRecords.reduce((sum, record) => {
      if (record.supplier.toLocaleLowerCase() !== name.toLocaleLowerCase()) return sum
      const dueUnits = record.kind === 'consignment' ? record.unitsSold : record.quantity
      return sum + Math.max(0, dueUnits * record.unitCost - record.settledAmount)
    }, 0),
  }))
  const selectedSupplierRecords = supplierRecords.filter(
    (record) => record.supplier.toLocaleLowerCase() === supplier.toLocaleLowerCase(),
  )
  const selectedSupplierPayments = supplierPayments.filter(
    (payment) => payment.supplier.toLocaleLowerCase() === supplier.toLocaleLowerCase(),
  )
  const selectedSupplierBalance = selectedSupplierRecords.reduce(
    (sum, record) => sum + supplierOutstanding(record),
    0,
  )
  const outstandingInvoices = invoices.reduce(
    (sum, invoice) => sum + Math.max(0, invoice.amount - invoice.paidAmount),
    0,
  )
  function submit(event: FormEvent<HTMLFormElement>, save: () => void) {
    event.preventDefault()
    setMessage('')
    save()
  }

  function saveSupplier(event: FormEvent<HTMLFormElement>) {
    submit(event, () => {
      const qty = amount(supplierQty)
      const cost = amount(supplierCost)
      if (!supplier || !supplierProduct.trim() || !Number.isInteger(qty) || qty < 1 || qty > 100 || !Number.isFinite(cost) || cost < 0 || !supplierReceived) {
        setMessage('Select a supplier and enter a product, valid quantity, unit cost and received date.')
        return
      }
      if (supplierDeviceDrafts.some((device) =>
        device.batteryHealth !== '' &&
        (!Number.isInteger(Number(device.batteryHealth)) || Number(device.batteryHealth) < 0 || Number(device.batteryHealth) > 100),
      )) {
        setMessage('Battery health must be a whole percentage from 0 to 100.')
        return
      }
      addSupplierRecord({
        kind: 'credit',
        supplier,
        product: supplierProduct.trim(),
        quantity: qty,
        unitCost: Math.round(cost),
        receivedAt: supplierReceived,
        dueDate: supplierDue || undefined,
        note: supplierNote.trim() || undefined,
        deviceDetails: supplierDeviceDrafts.map((device) => ({
          imei: device.imei.trim() || undefined,
          imei2: device.imei2.trim() || undefined,
          serialNumber: device.serialNumber.trim() || undefined,
          color: device.color.trim() || undefined,
          storage: device.storage.trim() || undefined,
          batteryHealth: device.batteryHealth ? Number(device.batteryHealth) : undefined,
          condition: device.condition || undefined,
        })),
      })
      setSupplierProduct('')
      setSupplierQty('')
      setSupplierCost('')
      setSupplierDue('')
      setSupplierNote('')
      setSupplierDeviceDrafts([])
      setMessage('Stock record saved.')
    })
  }

  function resizeSupplierDeviceDrafts(rawQty: string) {
    setSupplierQty(rawQty)
    const qty = Number(rawQty)
    if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
      setSupplierDeviceDrafts([])
      return
    }
    setSupplierDeviceDrafts((drafts) =>
      Array.from({ length: qty }, (_, index) => drafts[index] ?? emptySupplierDevice()),
    )
  }

  function saveSupplierPayment(event: FormEvent<HTMLFormElement>) {
    submit(event, () => {
      const value = amount(supplierPaymentDraft)
      if (!supplier || !Number.isInteger(value) || value <= 0 || value > selectedSupplierBalance) {
        setMessage('Enter a payment greater than zero and no more than this supplier’s outstanding balance.')
        return
      }
      addSupplierSettlement(supplier, Math.round(value))
      setSupplierPaymentDraft('')
      setMessage(`Payment recorded for ${supplier}.`)
    })
  }

  function downloadSupplierHistory() {
    if (!supplier) return
    const escapeCsv = (value: string | number) => {
      const text = typeof value === 'string' && /^[\s]*[=+\-@]/.test(value)
        ? `'${value}`
        : String(value)
      return `"${text.replace(/"/g, '""')}"`
    }
    const rows: (string | number)[][] = [
      ['Supplier', 'Date', 'Activity', 'Reference / details', 'Quantity', 'Amount (KSh)', 'Settled (KSh)', 'Balance (KSh)'],
      ...selectedSupplierRecords.map((record) => {
        const obligation = (record.kind === 'consignment' ? record.unitsSold : record.quantity) * record.unitCost
        return [
          supplier,
          record.receivedAt,
          'Stock received',
          `${record.id} · ${record.product}${record.note ? ` — ${record.note}` : ''}${record.deviceDetails?.length ? ` — ${record.deviceDetails.map((device, index) => `Unit ${index + 1}: ${[
            device.imei ? `IMEI ${device.imei}` : '',
            device.imei2 ? `IMEI2 ${device.imei2}` : '',
            device.serialNumber ? `Serial ${device.serialNumber}` : '',
            device.storage ?? '',
            device.color ?? '',
            device.batteryHealth !== undefined ? `Battery ${device.batteryHealth}%` : '',
            device.condition ?? '',
          ].filter(Boolean).join(' ')}`).join('; ')}` : ''}`,
          record.quantity,
          obligation,
          record.settledAmount,
          supplierOutstanding(record),
        ]
      }),
      ...selectedSupplierPayments.map((payment) => [
        supplier,
        payment.paidAt,
        'Payment',
        `Supplier settlement ${payment.id}`,
        '',
        -payment.amount,
        payment.amount,
        '',
      ]),
    ]
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${supplier.replace(/[^a-z0-9-_]+/gi, '-')}-supplier-history.csv`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function saveNewSupplier(event: FormEvent<HTMLFormElement>) {
    submit(event, () => {
      const name = newSupplierName.trim()
      if (!name) {
        setMessage('Enter a supplier name.')
        return
      }
      const existing = supplierNames.find(
        (item) => item.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
      if (existing) {
        setSupplier(existing)
        setMessage('That supplier already exists and is selected.')
        return
      }
      addSupplier(name)
      setSupplier(name)
      setNewSupplierName('')
      setMessage('Supplier created and selected.')
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

  const forms = {
    suppliers: (
      <form onSubmit={saveNewSupplier} className="flex flex-col gap-3 border-b border-line bg-subtle/40 p-5 sm:flex-row sm:items-end">
        <Field label="Create supplier">
          <input required value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="Supplier name" className="input" />
        </Field>
        <button className="btn-secondary shrink-0" type="submit"><Plus className="h-4 w-4" /> Create supplier</button>
      </form>
    ),
    stock: (
      <>
      <form onSubmit={saveSupplier} className="grid gap-3 border-b border-line p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Select supplier">
          <select required value={supplier} onChange={(e) => setSupplier(e.target.value)} className="input">
            <option value="">Choose a supplier</option>
            {supplierNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
        <Field label="Product / stock"><input required value={supplierProduct} onChange={(e) => setSupplierProduct(e.target.value)} className="input" /></Field>
        <Field label="Units received"><input required type="number" min="1" max="100" step="1" value={supplierQty} onChange={(e) => resizeSupplierDeviceDrafts(e.target.value)} className="input" /></Field>
        <Field label="Cost per unit (KSh)"><input required type="number" min="0" step="1" value={supplierCost} onChange={(e) => setSupplierCost(e.target.value)} className="input" /></Field>
        <Field label="Received on"><input required type="date" value={supplierReceived} onChange={(e) => setSupplierReceived(e.target.value)} className="input" /></Field>
        <Field label="Due date (optional)"><input type="date" value={supplierDue} onChange={(e) => setSupplierDue(e.target.value)} className="input" /></Field>
        <Field label="Note (optional)"><input value={supplierNote} onChange={(e) => setSupplierNote(e.target.value)} className="input" /></Field>
        <div className="sm:col-span-2 lg:col-span-4">
          <p className="text-xs text-fg-muted">For phones, add the IMEI and specifications for each unit below before recording this delivery.</p>
        </div>
      {supplierDeviceDrafts.length > 0 ? (
        <div className="space-y-3 border-b border-line p-5 sm:col-span-2 lg:col-span-4">
          <div>
            <h3 className="text-sm font-semibold">Received device details</h3>
            <p className="mt-1 text-xs text-fg-muted">Enter details separately for every phone. These are saved with the stock record and shown in the Stock list.</p>
          </div>
          {supplierDeviceDrafts.map((device, index) => (
            <div key={index} className="rounded-xl border border-line p-3">
              <p className="eyebrow mb-2">Unit {index + 1}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <input aria-label={`IMEI for received unit ${index + 1}`} placeholder="IMEI" value={device.imei} onChange={(e) => setSupplierDeviceDrafts((drafts) => drafts.map((draft, i) => i === index ? { ...draft, imei: e.target.value } : draft))} className="input font-mono text-xs" />
                <input aria-label={`IMEI2 for received unit ${index + 1}`} placeholder="IMEI2 (optional)" value={device.imei2} onChange={(e) => setSupplierDeviceDrafts((drafts) => drafts.map((draft, i) => i === index ? { ...draft, imei2: e.target.value } : draft))} className="input font-mono text-xs" />
                <input aria-label={`Serial number for received unit ${index + 1}`} placeholder="Serial number" value={device.serialNumber} onChange={(e) => setSupplierDeviceDrafts((drafts) => drafts.map((draft, i) => i === index ? { ...draft, serialNumber: e.target.value } : draft))} className="input font-mono text-xs" />
                <input aria-label={`Color for received unit ${index + 1}`} placeholder="Color" value={device.color} onChange={(e) => setSupplierDeviceDrafts((drafts) => drafts.map((draft, i) => i === index ? { ...draft, color: e.target.value } : draft))} className="input text-xs" />
                <input aria-label={`Storage for received unit ${index + 1}`} placeholder="Storage (e.g. 128GB)" value={device.storage} onChange={(e) => setSupplierDeviceDrafts((drafts) => drafts.map((draft, i) => i === index ? { ...draft, storage: e.target.value } : draft))} className="input text-xs" />
                <input aria-label={`Battery health for received unit ${index + 1}`} placeholder="Battery health %" type="number" min="0" max="100" step="1" value={device.batteryHealth} onChange={(e) => setSupplierDeviceDrafts((drafts) => drafts.map((draft, i) => i === index ? { ...draft, batteryHealth: e.target.value } : draft))} className="input text-xs" />
                <select aria-label={`Condition for received unit ${index + 1}`} value={device.condition} onChange={(e) => setSupplierDeviceDrafts((drafts) => drafts.map((draft, i) => i === index ? { ...draft, condition: e.target.value } : draft))} className="input text-xs">
                  <option value="">Condition (optional)</option>
                  {['New', 'Excellent', 'Good', 'Fair', 'Poor', 'For parts'].map((condition) => <option key={condition}>{condition}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      ) : null}
        <div className="sm:col-span-2 lg:col-span-4"><button className="btn-primary" type="submit"><Plus className="h-4 w-4" /> Record stock</button></div>
      </form>
      </>
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
  }

  function supplierOutstanding(record: (typeof supplierRecords)[number]) {
    const dueUnits = record.kind === 'consignment' ? record.unitsSold : record.quantity
    return Math.max(0, dueUnits * record.unitCost - record.settledAmount)
  }

  const supplierSummaryTable = (
    <div className="overflow-x-auto border-b border-line">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="table-head"><tr>
          <th className="px-5 py-3">Supplier</th><th className="px-5 py-3">Total received</th><th className="px-5 py-3">Total paid</th><th className="px-5 py-3">Balance</th>
        </tr></thead>
        <tbody className="divide-y divide-line">
          {supplierBalances.length === 0
            ? <tr><td colSpan={4} className="px-5 py-6 text-center text-fg-muted">Create a supplier to start tracking balances.</td></tr>
            : supplierBalances.map(({ name, balance }) => {
              const records = supplierRecords.filter((record) => record.supplier.toLocaleLowerCase() === name.toLocaleLowerCase())
              const received = records.reduce((sum, record) => sum + (record.kind === 'consignment' ? record.unitsSold : record.quantity) * record.unitCost, 0)
              const settled = records.reduce((sum, record) => sum + record.settledAmount, 0)
              return (
              <tr key={name} className={supplier === name ? 'bg-accent/5' : ''}>
                <td className="px-5 py-3">
                  <button type="button" onClick={() => setSupplier(name)} className="font-medium text-accent hover:underline">{name}</button>
                </td>
                <td className="px-5 py-3 tabular-nums">{formatKES(received)}</td>
                <td className="px-5 py-3 tabular-nums">{formatKES(settled)}</td>
                <td className={`px-5 py-3 font-semibold tabular-nums ${balance ? 'text-warning' : 'text-success'}`}>{formatKES(balance)}</td>
              </tr>
            )})}
        </tbody>
      </table>
    </div>
  )

  const stockTable = (
    <div className="overflow-x-auto border-t border-line">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead className="table-head"><tr>
          <th className="px-5 py-3">Supplier</th><th className="px-5 py-3">Received / reference</th>
          <th className="px-5 py-3">Product / device details</th><th className="px-5 py-3">Units</th>
          <th className="px-5 py-3">Purchase total</th>
        </tr></thead>
        <tbody className="divide-y divide-line">
          {supplierRecords.length === 0
            ? <tr><td colSpan={5} className="px-5 py-8 text-center text-fg-muted">No stock received yet. Use the form above to record a delivery.</td></tr>
            : supplierRecords.map((record) => (
              <tr key={record.id}>
                <td className="px-5 py-3 font-medium">{record.supplier}</td>
                <td className="px-5 py-3 text-xs text-fg-muted">{dateLabel(record.receivedAt)}<p className="font-mono">{record.id.slice(0, 8)}</p></td>
                <td className="px-5 py-3">
                  <p className="font-medium">{record.product}</p>
                  {record.deviceDetails?.some((device) =>
                    device.imei || device.imei2 || device.serialNumber || device.storage ||
                    device.color || device.batteryHealth !== undefined || device.condition,
                  ) ? (
                    <ul className="mt-2 space-y-1 text-xs text-fg-muted">
                      {record.deviceDetails.map((device, index) => (
                        <li key={index}>
                          Unit {index + 1}
                          {device.imei ? ` · IMEI ${device.imei}` : ''}
                          {device.imei2 ? ` · IMEI2 ${device.imei2}` : ''}
                          {device.serialNumber ? ` · Serial ${device.serialNumber}` : ''}
                          {device.storage ? ` · ${device.storage}` : ''}
                          {device.color ? ` · ${device.color}` : ''}
                          {device.batteryHealth !== undefined ? ` · Battery ${device.batteryHealth}%` : ''}
                          {device.condition ? ` · ${device.condition}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-xs text-fg-muted">No unit details recorded</p>}
                </td>
                <td className="px-5 py-3">{record.quantity}</td>
                <td className="px-5 py-3 font-semibold tabular-nums">{formatKES(record.quantity * record.unitCost)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )

  const supplierTable = (
    <div className="space-y-5 p-5">
      {!supplier ? <p className="text-sm text-fg-muted">Choose a supplier above to view their full history and balance.</p> : (
        <>
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-subtle/40 p-4 sm:flex-row sm:items-center">
            <div>
              <p className="eyebrow">Supplier account</p>
              <h3 className="mt-1 text-lg font-semibold">{supplier}</h3>
              <p className="mt-1 text-sm text-fg-muted">Outstanding balance: <span className="font-semibold tabular-nums text-fg">{formatKES(selectedSupplierBalance)}</span></p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form onSubmit={saveSupplierPayment} className="flex gap-2">
                <input aria-label={`Payment to ${supplier}`} type="number" min="1" max={selectedSupplierBalance} step="1" value={supplierPaymentDraft} onChange={(e) => setSupplierPaymentDraft(e.target.value)} placeholder="Settled amount" className="input w-36" />
                <button type="submit" disabled={selectedSupplierBalance <= 0} className="btn-primary">Add payment</button>
              </form>
              <button type="button" onClick={downloadSupplierHistory} className="btn-secondary">
                <Download className="h-4 w-4" /> Export Excel CSV
              </button>
            </div>
          </div>
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><FileSpreadsheet className="h-4 w-4 text-accent" /> Stock received history</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="table-head"><tr>
                  <th className="px-4 py-3">Date / reference</th><th className="px-4 py-3">Product</th><th className="px-4 py-3">Units</th><th className="px-4 py-3">Received total</th><th className="px-4 py-3">Settled</th><th className="px-4 py-3">Balance</th>
                </tr></thead>
                <tbody className="divide-y divide-line">
                  {selectedSupplierRecords.length === 0
                    ? <tr><td colSpan={6} className="px-4 py-6 text-center text-fg-muted">No stock history for this supplier yet.</td></tr>
                    : selectedSupplierRecords.map((record) => {
                      const obligation = (record.kind === 'consignment' ? record.unitsSold : record.quantity) * record.unitCost
                      return <tr key={record.id}>
                        <td className="px-4 py-3 text-xs text-fg-muted">{dateLabel(record.receivedAt)}<p className="font-mono">{record.id.slice(0, 8)}</p>{record.dueDate ? <p>Due {dateLabel(record.dueDate)}</p> : null}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{record.product}</p>
                          <p className="text-xs text-fg-muted">{formatKES(record.unitCost)} each{record.note ? ` · ${record.note}` : ''}</p>
                          {record.deviceDetails?.some((device) =>
                            device.imei || device.imei2 || device.serialNumber || device.storage ||
                            device.color || device.batteryHealth !== undefined || device.condition,
                          ) ? (
                            <ul className="mt-2 space-y-1 text-xs text-fg-muted">
                              {record.deviceDetails.map((device, index) => (
                                <li key={index}>
                                  Unit {index + 1}
                                  {device.imei ? ` · IMEI ${device.imei}` : ''}
                                  {device.imei2 ? ` · IMEI2 ${device.imei2}` : ''}
                                  {device.serialNumber ? ` · S/N ${device.serialNumber}` : ''}
                                  {device.storage ? ` · ${device.storage}` : ''}
                                  {device.color ? ` · ${device.color}` : ''}
                                  {device.batteryHealth !== undefined ? ` · Battery ${device.batteryHealth}%` : ''}
                                  {device.condition ? ` · ${device.condition}` : ''}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">{record.quantity}</td>
                        <td className="px-4 py-3 tabular-nums">{formatKES(obligation)}</td>
                        <td className="px-4 py-3 tabular-nums">{formatKES(record.settledAmount)}</td>
                        <td className="px-4 py-3 font-semibold tabular-nums">{formatKES(supplierOutstanding(record))}</td>
                      </tr>
                    })}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold">Payment history</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="table-head"><tr><th className="px-4 py-3">Paid on</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Amount</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {selectedSupplierPayments.length === 0
                    ? <tr><td colSpan={3} className="px-4 py-6 text-center text-fg-muted">No payment history saved yet. Earlier settlements remain included in the stock balances.</td></tr>
                    : selectedSupplierPayments.map((payment) => (
                      <tr key={payment.id}><td className="px-4 py-3">{new Date(payment.paidAt).toLocaleString('en-KE')}</td><td className="px-4 py-3 font-mono text-xs">{payment.id.slice(0, 8)}</td><td className="px-4 py-3 font-semibold tabular-nums">{formatKES(payment.amount)}</td></tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
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
          <SectionCard title="Supplier balances" description="Outstanding amount due across all supplier stock accounts">
            <div className="p-5"><p className="text-2xl font-semibold tabular-nums">{formatKES(supplierBalance)}</p><p className="mt-1 text-sm text-fg-muted">{supplierRecords.length} stock records across {supplierNames.length} suppliers</p></div>
          </SectionCard>
          <SectionCard title="Accounts receivable" description="Outstanding customer invoice amounts">
            <div className="p-5"><p className="text-2xl font-semibold tabular-nums">{formatKES(outstandingInvoices)}</p><p className="mt-1 text-sm text-fg-muted">{invoices.filter((invoice) => invoice.amount > invoice.paidAmount).length} unpaid or partial invoices</p></div>
          </SectionCard>
        </div>
      </> : null}

      {view === 'suppliers' ? <SectionCard title="Suppliers" description="Create suppliers, compare balances, and select one to review its stock and payment history.">
        {forms.suppliers}{supplierSummaryTable}{supplierTable}
      </SectionCard> : null}
      {view === 'stock' ? <SectionCard title="Receive & track stock" description="Choose a supplier, record each delivery, and capture identifiers and phone specifications when stock arrives.">
        {forms.stock}{stockTable}
      </SectionCard> : null}
      {view === 'expenses' ? <SectionCard title="Operating expenses" description="Record business expenses and their VAT rates for reference.">
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
          <tbody className="divide-y divide-line">{tradeIns.length === 0 ? <tr><td colSpan={6} className="px-5 py-8 text-center text-fg-muted">No trade-ins recorded yet.</td></tr> : tradeIns.map((trade) => <tr key={trade.id}><td className="px-5 py-3">{dateLabel(trade.receivedAt)}</td><td className="px-5 py-3 font-medium">{trade.customer}</td><td className="px-5 py-3">{trade.device}{trade.imei ? <p className="font-mono text-xs text-fg-muted">IMEI {trade.imei}</p> : null}{trade.imei2 ? <p className="font-mono text-xs text-fg-muted">IMEI2 {trade.imei2}</p> : null}{trade.serialNumber ? <p className="font-mono text-xs text-fg-muted">S/N {trade.serialNumber}</p> : null}{trade.storage || trade.color ? <p className="text-xs text-fg-muted">{[trade.storage, trade.color].filter(Boolean).join(' · ')}</p> : null}{trade.batteryHealth !== undefined ? <p className="text-xs text-fg-muted">Battery {trade.batteryHealth}%</p> : null}</td><td className="px-5 py-3">{trade.condition}</td><td className="px-5 py-3 font-semibold tabular-nums">{formatKES(trade.value)}</td><td className="px-5 py-3">{trade.saleReference || '—'}</td></tr>)}</tbody>
        </table></div>
      </SectionCard> : null}
      <p className="text-xs text-fg-subtle">Records are stored with this POS data on this device. Reports use all recorded dates and are operational summaries, not tax filings.</p>
    </div>
  )
}

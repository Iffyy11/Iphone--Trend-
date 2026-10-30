import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import crypto from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createAdmin,
  createCashier,
  createSessionToken,
  deleteCashier,
  findSession,
  findAdminByEmail,
  hasAdmin,
  hashWithSalt,
  initializeDatabase,
  listCashiers,
  normalizeEmail,
  pingDatabase,
  randomSalt,
  readPosState,
  resetPosState,
  saveSession,
  updateCashierPin,
  writePosState,
} from './db.mjs'

const app = express()
const port = Number(process.env.PORT) || 8787
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')

const frontendOrigin = process.env.FRONTEND_ORIGIN?.trim()
app.use(
  cors({
    origin: frontendOrigin || true,
    credentials: true,
  }),
)
app.use(express.json({ limit: '10mb' }))
app.use(express.static(webRoot))

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'iphone-trend-api' })
})

app.get('/api/health', async (_req, res) => {
  try {
    await pingDatabase()
    res.json({ ok: true, database: 'connected' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(503).json({ ok: false, database: 'error', message })
  }
})

app.get('/api/admin/status', async (_req, res) => {
  try {
    res.json({ ok: true, hasAdmin: await hasAdmin() })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(503).json({ ok: false, message })
  }
})

function requireSession(req, res, next) {
  const authorization = req.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  findSession(token)
    .then((session) => {
      if (!session) {
        res.status(401).json({ ok: false, message: 'Sign in again to access shared POS data.' })
        return
      }
      req.posSession = session
      next()
    })
    .catch((e) => {
      const message = e instanceof Error ? e.message : 'Unknown error'
      res.status(500).json({ ok: false, message })
    })
}

function requireAdmin(req, res, next) {
  requireSession(req, res, () => {
    if (req.posSession.role !== 'admin') {
      res.status(403).json({ ok: false, message: 'Administrator access is required.' })
      return
    }
    next()
  })
}

app.post('/api/admin/bootstrap', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const password = String(req.body?.password || '')
    if (!email || !password) {
      res.status(400).json({ ok: false, message: 'Email and password are required.' })
      return
    }
    const salt = randomSalt()
    const passwordHash = hashWithSalt(password, salt)
    if (!await createAdmin({ email, salt, passwordHash })) {
      res.status(409).json({ ok: false, message: 'Administrator already exists.' })
      return
    }
    res.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ ok: false, message })
  }
})

app.post('/api/admin/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const password = String(req.body?.password || '')
    if (!email || !password) {
      res.status(400).json({ ok: false, message: 'Email and password are required.' })
      return
    }
    const admin = await findAdminByEmail(email)
    if (!admin) {
      res.status(401).json({ ok: false })
      return
    }
    const passwordHash = hashWithSalt(password, admin.salt)
    if (passwordHash !== admin.passwordHash) {
      res.status(401).json({ ok: false })
      return
    }
    const staffName = email.split('@')[0] || 'Admin'
    const token = createSessionToken()
    await saveSession(token, 'admin', staffName)
    res.json({ ok: true, staffName, token })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ ok: false, message })
  }
})

app.get('/api/cashiers', requireAdmin, async (_req, res) => {
  try {
    const rows = await listCashiers()
    res.json({ ok: true, cashiers: rows })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ ok: false, message })
  }
})

app.post('/api/cashiers', requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim()
    const pin = String(req.body?.pin || '')
    if (!name || !pin) {
      res.status(400).json({ ok: false, message: 'Name and PIN are required.' })
      return
    }
    const id = crypto.randomUUID()
    const pinSalt = randomSalt()
    const pinHash = hashWithSalt(pin, pinSalt)
    const cashier = { id, name, pinPlain: pin, pinSalt, pinHash, createdAt: new Date().toISOString() }
    const savedCashier = await createCashier(cashier)
    res.json({ ok: true, cashier: savedCashier })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ ok: false, message })
  }
})

app.patch('/api/cashiers/:id/pin', requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim()
    const pin = String(req.body?.pin || '')
    if (!id || !pin) {
      res.status(400).json({ ok: false, message: 'Cashier id and PIN are required.' })
      return
    }
    const pinSalt = randomSalt()
    const pinHash = hashWithSalt(pin, pinSalt)
    const result = await updateCashierPin(id, pin, pinSalt, pinHash)
    if (!result) {
      res.status(404).json({ ok: false, message: 'Cashier not found.' })
      return
    }
    res.json({ ok: true, cashier: result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ ok: false, message })
  }
})

app.delete('/api/cashiers/:id', requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim()
    if (!id) {
      res.status(400).json({ ok: false, message: 'Cashier id is required.' })
      return
    }
    await deleteCashier(id)
    res.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ ok: false, message })
  }
})

app.post('/api/cashiers/login', async (req, res) => {
  try {
    const pin = String(req.body?.pin || '')
    if (!pin) {
      res.status(400).json({ ok: false, message: 'PIN is required.' })
      return
    }
    const rows = await listCashiers({ includePinPlain: false })
    for (const c of rows) {
      const h = hashWithSalt(pin, c.pinSalt)
      if (h === c.pinHash) {
        const token = createSessionToken()
        await saveSession(token, 'cashier', c.name)
        res.json({ ok: true, staffName: c.name, token })
        return
      }
    }
    res.status(401).json({ ok: false })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ ok: false, message })
  }
})

app.get('/api/pos/state', requireSession, async (_req, res) => {
  try {
    res.json({ ok: true, ...(await readPosState()) })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ ok: false, message })
  }
})

app.put('/api/pos/state', requireSession, async (req, res) => {
  try {
    if (req.body?.initialize === true && req.posSession.role !== 'admin') {
      res.status(403).json({ ok: false, message: 'Only an administrator can initialize shared data.' })
      return
    }
    const data = req.body?.data
    const expectedEpoch = Number(req.body?.epoch)
    const expectedRevision = Number(req.body?.revision)
    const requiredArrays = [
      'products', 'orders', 'suppliers', 'supplierRecords',
      'supplierPayments', 'expenses', 'invoices', 'tradeIns',
    ]
    if (
      !data ||
      !Number.isSafeInteger(expectedEpoch) ||
      !Number.isSafeInteger(expectedRevision) ||
      requiredArrays.some((key) => !Array.isArray(data[key]))
    ) {
      res.status(400).json({ ok: false, message: 'A complete POS data snapshot and epoch are required.' })
      return
    }
    const current = await readPosState()
    if (
      current.initialized &&
      (expectedEpoch !== current.epoch || expectedRevision !== current.revision)
    ) {
      res.json({ ok: true, conflict: true, ...current })
      return
    }
    if (req.posSession.role === 'cashier') {
      if (!current.initialized || !current.data) {
        res.status(409).json({ ok: false, message: 'An administrator must initialize shared POS data first.' })
        return
      }
      const unchanged = (key) =>
        JSON.stringify(data[key]) === JSON.stringify(current.data[key])
      const restrictedKeys = [
        'products', 'suppliers', 'supplierRecords', 'supplierPayments',
        'expenses', 'invoices',
      ]
      if (restrictedKeys.some((key) => !unchanged(key))) {
        res.status(403).json({ ok: false, message: 'Cashiers cannot change products or finance records.' })
        return
      }
      const incomingOrders = new Map(data.orders.map((order) => [order.id, order]))
      for (const order of current.data.orders) {
        const incoming = incomingOrders.get(order.id)
        if (incoming && JSON.stringify(incoming) !== JSON.stringify(order)) {
          res.status(403).json({ ok: false, message: 'Cashiers cannot edit previous sales.' })
          return
        }
      }
      const currentTradeInIds = new Set(current.data.tradeIns.map((tradeIn) => tradeIn.id))
      const allOrders = new Map([...current.data.orders, ...data.orders].map((order) => [order.id, order]))
      for (const tradeIn of data.tradeIns) {
        if (currentTradeInIds.has(tradeIn.id)) continue
        const relatedSale = allOrders.get(tradeIn.saleReference)
        if (!relatedSale || relatedSale.tradeInValue <= 0) {
          res.status(403).json({ ok: false, message: 'Trade-ins must be linked to a sale.' })
          return
        }
      }
      for (const order of data.orders) {
        if (current.data.orders.some((saved) => saved.id === order.id)) continue
        if (order.role !== 'cashier' || order.staffLabel !== req.posSession.staffName) {
          res.status(403).json({ ok: false, message: 'Sales must be recorded under the signed-in cashier.' })
          return
        }
      }
    }
    const result = await writePosState(data, expectedEpoch, expectedRevision, {
      initialize: req.body?.initialize === true && req.posSession.role === 'admin',
    })
    res.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ ok: false, message })
  }
})

app.post('/api/pos/reset', requireSession, async (req, res) => {
  if (req.posSession.role !== 'admin') {
    res.status(403).json({ ok: false, message: 'Only an administrator can reset POS records.' })
    return
  }
  try {
    const expectedEpoch = Number(req.body?.epoch)
    const expectedRevision = Number(req.body?.revision)
    if (!Number.isSafeInteger(expectedEpoch) || expectedEpoch < 1 || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
      res.status(400).json({ ok: false, message: 'A valid shared data version is required.' })
      return
    }
    const result = await resetPosState(expectedEpoch, expectedRevision)
    res.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ ok: false, message })
  }
})

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    next()
    return
  }
  res.sendFile(resolve(webRoot, 'index.html'), (error) => {
    if (error) next(error)
  })
})

await initializeDatabase()
app.listen(port, () => {
  console.log(`iPhone Trend app and API listening on port ${port}`)
})

import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import crypto from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createAdmin,
  createCashier,
  deleteCashier,
  findAdminByEmail,
  hasAdmin,
  hashWithSalt,
  initializeDatabase,
  listCashiers,
  normalizeEmail,
  pingDatabase,
  randomSalt,
  updateCashierPin,
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
app.use(express.json())
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
    res.json({ ok: true, staffName })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ ok: false, message })
  }
})

app.get('/api/cashiers', async (_req, res) => {
  try {
    const rows = await listCashiers()
    res.json({ ok: true, cashiers: rows })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ ok: false, message })
  }
})

app.post('/api/cashiers', async (req, res) => {
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

app.patch('/api/cashiers/:id/pin', async (req, res) => {
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

app.delete('/api/cashiers/:id', async (req, res) => {
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
        res.json({ ok: true, staffName: c.name })
        return
      }
    }
    res.status(401).json({ ok: false })
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

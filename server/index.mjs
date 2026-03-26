import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import crypto from 'node:crypto'
import { getDb, getMongoClient } from './db.mjs'

const app = express()
const port = Number(process.env.PORT) || 8787

const frontendOrigin = process.env.FRONTEND_ORIGIN?.trim()
app.use(
  cors({
    origin: frontendOrigin || true,
    credentials: true,
  }),
)
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'iphone-trend-api' })
})

app.get('/api/health', async (_req, res) => {
  try {
    const mongo = await getMongoClient()
    await mongo.db('admin').command({ ping: 1 })
    res.json({ ok: true, database: 'connected' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(503).json({ ok: false, database: 'error', message })
  }
})

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function randomSalt() {
  return crypto.randomBytes(16).toString('hex')
}

function hashWithSalt(secret, salt) {
  return crypto.createHash('sha256').update(`${salt}:${secret}`).digest('hex')
}

app.get('/api/admin/status', async (_req, res) => {
  try {
    const db = await getDb()
    const admin = await db.collection('admins').findOne({}, { projection: { _id: 1 } })
    res.json({ ok: true, hasAdmin: Boolean(admin) })
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
    const db = await getDb()
    const admins = db.collection('admins')
    const hasAdmin = await admins.findOne({}, { projection: { _id: 1 } })
    if (hasAdmin) {
      res.status(409).json({ ok: false, message: 'Administrator already exists.' })
      return
    }
    const salt = randomSalt()
    const passwordHash = hashWithSalt(password, salt)
    await admins.insertOne({
      email,
      salt,
      passwordHash,
      createdAt: new Date().toISOString(),
    })
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
    const db = await getDb()
    const admin = await db.collection('admins').findOne({ email })
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
    const db = await getDb()
    const rows = await db
      .collection('cashiers')
      .find({}, { projection: { _id: 0, id: 1, name: 1, pinPlain: 1, pinSalt: 1, pinHash: 1 } })
      .toArray()
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
    const db = await getDb()
    await db.collection('cashiers').insertOne(cashier)
    res.json({ ok: true, cashier: { id, name, pinPlain: pin, pinSalt, pinHash } })
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
    const db = await getDb()
    const result = await db.collection('cashiers').findOneAndUpdate(
      { id },
      { $set: { pinPlain: pin, pinSalt, pinHash, updatedAt: new Date().toISOString() } },
      { returnDocument: 'after', projection: { _id: 0, id: 1, name: 1, pinPlain: 1, pinSalt: 1, pinHash: 1 } },
    )
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
    const db = await getDb()
    await db.collection('cashiers').deleteOne({ id })
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
    const db = await getDb()
    const rows = await db.collection('cashiers').find({}, { projection: { _id: 0, id: 1, name: 1, pinSalt: 1, pinHash: 1 } }).toArray()
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

app.listen(port, () => {
  console.log(`API http://localhost:${port}  (GET /health, GET /api/health)`)
})

import crypto from 'node:crypto'
import { Pool } from 'pg'

let pool
let schemaPromise

export function getPool() {
  const connectionString = process.env.DATABASE_URL?.trim()
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Add the Render PostgreSQL connection string.')
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX) || 5,
      ...(process.env.PGSSLMODE === 'require'
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
    })
  }
  return pool
}

export async function initializeDatabase() {
  if (!schemaPromise) {
    schemaPromise = getPool().query(`
        CREATE TABLE IF NOT EXISTS admins (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          salt TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS admins_singleton_idx ON admins ((true));
        CREATE TABLE IF NOT EXISTS cashiers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          pin_plain TEXT NOT NULL,
          pin_salt TEXT NOT NULL,
          pin_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ
        );
        CREATE TABLE IF NOT EXISTS app_state (
          id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
          data JSONB NOT NULL,
          epoch BIGINT NOT NULL DEFAULT 1,
          revision BIGINT NOT NULL DEFAULT 1,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE app_state ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1;
        CREATE TABLE IF NOT EXISTS auth_sessions (
          token_hash TEXT PRIMARY KEY,
          role TEXT NOT NULL CHECK (role IN ('admin', 'cashier')),
          staff_name TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)
      .catch((error) => {
        schemaPromise = undefined
        throw error
      })
  }
  await schemaPromise
  return getPool()
}

export async function pingDatabase() {
  const db = await initializeDatabase()
  await db.query('SELECT 1')
}

export function createSessionToken() {
  return crypto.randomBytes(32).toString('base64url')
}

export async function saveSession(token, role, staffName) {
  const db = await initializeDatabase()
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  await db.query(
    `INSERT INTO auth_sessions (token_hash, role, staff_name, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')`,
    [tokenHash, role, staffName],
  )
}

export async function findSession(token) {
  if (!token) return null
  const db = await initializeDatabase()
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const result = await db.query(
    `SELECT role, staff_name AS "staffName"
     FROM auth_sessions WHERE token_hash = $1 AND expires_at > NOW()`,
    [tokenHash],
  )
  return result.rows[0] ?? null
}

function emptyPosData(products = []) {
  return {
    products,
    orders: [],
    suppliers: [],
    supplierRecords: [],
    supplierPayments: [],
    expenses: [],
    invoices: [],
    tradeIns: [],
  }
}

function mergeById(existing = [], incoming = [], key, mergeRecord = (_old, next) => next) {
  const result = new Map(existing.map((item) => [item[key], item]))
  for (const item of incoming) {
    if (!item || typeof item[key] !== 'string') continue
    result.set(item[key], mergeRecord(result.get(item[key]), item))
  }
  return [...result.values()]
}

function mergePosData(existing, incoming) {
  return {
    products: mergeById(existing.products, incoming.products, 'id'),
    orders: mergeById(existing.orders, incoming.orders, 'id', (old, next) =>
      old?.status === 'void' ? { ...next, status: 'void' } : next),
    suppliers: [...new Set([...(existing.suppliers ?? []), ...(incoming.suppliers ?? [])])],
    supplierRecords: mergeById(existing.supplierRecords, incoming.supplierRecords, 'id', (old, next) =>
      old ? { ...next, settledAmount: Math.max(old.settledAmount ?? 0, next.settledAmount ?? 0) } : next),
    supplierPayments: mergeById(existing.supplierPayments, incoming.supplierPayments, 'id'),
    expenses: mergeById(existing.expenses, incoming.expenses, 'id'),
    invoices: mergeById(existing.invoices, incoming.invoices, 'id', (old, next) =>
      old ? { ...next, paidAmount: Math.max(old.paidAmount ?? 0, next.paidAmount ?? 0) } : next),
    tradeIns: mergeById(existing.tradeIns, incoming.tradeIns, 'id'),
  }
}

export async function readPosState() {
  const db = await initializeDatabase()
  const result = await db.query('SELECT data, epoch, revision FROM app_state WHERE id = TRUE')
  if (!result.rows[0]) return { initialized: false, epoch: 0, revision: 0, data: null }
  return {
    initialized: true,
    epoch: Number(result.rows[0].epoch),
    revision: Number(result.rows[0].revision),
    data: result.rows[0].data,
  }
}

export async function writePosState(data, expectedEpoch, expectedRevision, { initialize = false } = {}) {
  const db = await initializeDatabase()
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query('SELECT data, epoch, revision FROM app_state WHERE id = TRUE FOR UPDATE')
    const row = result.rows[0]
    if (!row) {
      if (!initialize) {
        await client.query('ROLLBACK')
        return { conflict: true, ...(await readPosState()) }
      }
      const cleanData = { ...emptyPosData(data.products ?? []), ...data }
      const inserted = await client.query(
        'INSERT INTO app_state (id, data, epoch, revision) VALUES (TRUE, $1, 1, 1) RETURNING data, epoch, revision',
        [JSON.stringify(cleanData)],
      )
      await client.query('COMMIT')
      return { conflict: false, initialized: true, epoch: Number(inserted.rows[0].epoch), revision: Number(inserted.rows[0].revision), data: inserted.rows[0].data }
    }
    if (Number(row.epoch) !== Number(expectedEpoch) || Number(row.revision) !== Number(expectedRevision)) {
      await client.query('ROLLBACK')
      return { conflict: true, initialized: true, epoch: Number(row.epoch), revision: Number(row.revision), data: row.data }
    }
    const merged = mergePosData(row.data, data)
    const updated = await client.query(
      'UPDATE app_state SET data = $1, revision = revision + 1, updated_at = NOW() WHERE id = TRUE RETURNING data, epoch, revision',
      [JSON.stringify(merged)],
    )
    await client.query('COMMIT')
    return { conflict: false, initialized: true, epoch: Number(updated.rows[0].epoch), revision: Number(updated.rows[0].revision), data: updated.rows[0].data }
  } catch (error) {
    await client.query('ROLLBACK')
    if (error?.code === '23505') {
      return { conflict: true, ...(await readPosState()) }
    }
    throw error
  } finally {
    client.release()
  }
}

export async function resetPosState(expectedEpoch, expectedRevision) {
  const db = await initializeDatabase()
  const result = await db.query(
    `UPDATE app_state
     SET data = jsonb_build_object(
       'products', COALESCE(data->'products', '[]'::jsonb),
       'orders', '[]'::jsonb,
       'suppliers', '[]'::jsonb,
       'supplierRecords', '[]'::jsonb,
       'supplierPayments', '[]'::jsonb,
       'expenses', '[]'::jsonb,
       'invoices', '[]'::jsonb,
       'tradeIns', '[]'::jsonb
     ),
     epoch = epoch + 1,
     revision = revision + 1,
     updated_at = NOW()
     WHERE id = TRUE AND epoch = $1 AND revision = $2
     RETURNING data, epoch, revision`,
    [expectedEpoch, expectedRevision],
  )
  if (!result.rows[0]) return { conflict: true, ...(await readPosState()) }
  return { conflict: false, initialized: true, epoch: Number(result.rows[0].epoch), revision: Number(result.rows[0].revision), data: result.rows[0].data }
}

export async function hasAdmin() {
  const db = await initializeDatabase()
  const result = await db.query('SELECT 1 FROM admins LIMIT 1')
  return result.rowCount > 0
}

export async function createAdmin({ email, salt, passwordHash }) {
  const db = await initializeDatabase()
  try {
    await db.query(
      'INSERT INTO admins (email, salt, password_hash) VALUES ($1, $2, $3)',
      [email, salt, passwordHash],
    )
    return true
  } catch (error) {
    if (error?.code === '23505') return false
    throw error
  }
}

export async function findAdminByEmail(email) {
  const db = await initializeDatabase()
  const result = await db.query(
    'SELECT email, salt, password_hash AS "passwordHash" FROM admins WHERE email = $1 LIMIT 1',
    [email],
  )
  return result.rows[0] ?? null
}

export async function listCashiers({ includePinPlain = true } = {}) {
  const db = await initializeDatabase()
  const pinPlainColumn = includePinPlain ? ', pin_plain AS "pinPlain"' : ''
  const result = await db.query(`
    SELECT id, name${pinPlainColumn}, pin_salt AS "pinSalt", pin_hash AS "pinHash"
    FROM cashiers
    ORDER BY created_at, id
  `)
  return result.rows
}

export async function createCashier(cashier) {
  const db = await initializeDatabase()
  const result = await db.query(`
    INSERT INTO cashiers (id, name, pin_plain, pin_salt, pin_hash)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name, pin_plain AS "pinPlain", pin_salt AS "pinSalt", pin_hash AS "pinHash"
  `, [cashier.id, cashier.name, cashier.pinPlain, cashier.pinSalt, cashier.pinHash])
  return result.rows[0]
}

export async function updateCashierPin(id, pin, pinSalt, pinHash) {
  const db = await initializeDatabase()
  const result = await db.query(`
    UPDATE cashiers
    SET pin_plain = $2, pin_salt = $3, pin_hash = $4, updated_at = NOW()
    WHERE id = $1
    RETURNING id, name, pin_plain AS "pinPlain", pin_salt AS "pinSalt", pin_hash AS "pinHash"
  `, [id, pin, pinSalt, pinHash])
  return result.rows[0] ?? null
}

export async function deleteCashier(id) {
  const db = await initializeDatabase()
  await db.query('DELETE FROM cashiers WHERE id = $1', [id])
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export function randomSalt() {
  return crypto.randomBytes(16).toString('hex')
}

export function hashWithSalt(secret, salt) {
  return crypto.createHash('sha256').update(`${salt}:${secret}`).digest('hex')
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body
  return await new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
      if (!data) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(data))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

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

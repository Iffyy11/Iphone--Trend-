import crypto from 'node:crypto'
import { MongoClient } from 'mongodb'

let clientPromise

function getUri() {
  const uri = process.env.MONGODB_URI?.trim()
  if (!uri) throw new Error('MONGODB_URI is not set')
  return uri
}

export async function getDb() {
  if (!clientPromise) {
    clientPromise = new MongoClient(getUri()).connect()
  }
  const client = await clientPromise
  const dbName = process.env.MONGODB_DB_NAME?.trim() || 'iphone_trend'
  return client.db(dbName)
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
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

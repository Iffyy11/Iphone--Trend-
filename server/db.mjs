import { MongoClient } from 'mongodb'

let client = null

export async function getMongoClient() {
  const uri = process.env.MONGODB_URI?.trim()
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy server/.env.example to server/.env.')
  }
  if (!client) {
    client = new MongoClient(uri)
    await client.connect()
  }
  return client
}

export function getDbName() {
  return process.env.MONGODB_DB_NAME?.trim() || 'iphone_trend'
}

export async function getDb() {
  const c = await getMongoClient()
  return c.db(getDbName())
}

export async function closeMongo() {
  if (client) {
    await client.close()
    client = null
  }
}

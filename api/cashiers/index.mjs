import crypto from 'node:crypto'
import { getDb, hashWithSalt, randomSalt, readJson } from '../_lib/db.mjs'

export default async function handler(req, res) {
  try {
    const db = await getDb()
    if (req.method === 'GET') {
      const rows = await db
        .collection('cashiers')
        .find({}, { projection: { _id: 0, id: 1, name: 1, pinPlain: 1, pinSalt: 1, pinHash: 1 } })
        .toArray()
      res.status(200).json({ ok: true, cashiers: rows })
      return
    }

    if (req.method === 'POST') {
      const body = await readJson(req)
      const name = String(body.name || '').trim()
      const pin = String(body.pin || '')
      if (!name || !pin) {
        res.status(400).json({ ok: false, message: 'Name and PIN are required.' })
        return
      }
      const id = crypto.randomUUID()
      const pinSalt = randomSalt()
      const pinHash = hashWithSalt(pin, pinSalt)
      const cashier = { id, name, pinPlain: pin, pinSalt, pinHash, createdAt: new Date().toISOString() }
      await db.collection('cashiers').insertOne(cashier)
      res.status(200).json({ ok: true, cashier: { id, name, pinPlain: pin, pinSalt, pinHash } })
      return
    }

    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ ok: false, message: 'Method not allowed' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ ok: false, message })
  }
}

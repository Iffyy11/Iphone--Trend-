import { getDb } from './_lib/db.mjs'

export default async function handler(_req, res) {
  try {
    const db = await getDb()
    await db.command({ ping: 1 })
    res.status(200).json({ ok: true, database: 'connected' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(503).json({ ok: false, database: 'error', message })
  }
}

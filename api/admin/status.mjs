import { getDb } from '../_lib/db.mjs'

export default async function handler(_req, res) {
  try {
    const db = await getDb()
    const admin = await db.collection('admins').findOne({}, { projection: { _id: 1 } })
    res.status(200).json({ ok: true, hasAdmin: Boolean(admin) })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(503).json({ ok: false, message })
  }
}

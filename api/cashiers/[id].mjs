import { getDb } from '../_lib/db.mjs'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE')
    res.status(405).json({ ok: false, message: 'Method not allowed' })
    return
  }

  try {
    const id = String(req.query.id || '').trim()
    if (!id) {
      res.status(400).json({ ok: false, message: 'Cashier id is required.' })
      return
    }
    const db = await getDb()
    await db.collection('cashiers').deleteOne({ id })
    res.status(200).json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ ok: false, message })
  }
}

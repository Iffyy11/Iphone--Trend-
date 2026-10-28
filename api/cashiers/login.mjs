import { hashWithSalt, listCashiers, readJson } from '../_lib/db.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ ok: false, message: 'Method not allowed' })
    return
  }

  try {
    const body = await readJson(req)
    const pin = String(body.pin || '')
    if (!pin) {
      res.status(400).json({ ok: false, message: 'PIN is required.' })
      return
    }
    const rows = await listCashiers({ includePinPlain: false })
    for (const c of rows) {
      const h = hashWithSalt(pin, c.pinSalt)
      if (h === c.pinHash) {
        res.status(200).json({ ok: true, staffName: c.name })
        return
      }
    }
    res.status(401).json({ ok: false })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ ok: false, message })
  }
}

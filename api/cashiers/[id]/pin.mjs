import { hashWithSalt, randomSalt, readJson, updateCashierPin } from '../../_lib/db.mjs'

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    res.status(405).json({ ok: false, message: 'Method not allowed' })
    return
  }

  try {
    const id = String(req.query.id || '').trim()
    const body = await readJson(req)
    const pin = String(body.pin || '')
    if (!id || !pin) {
      res.status(400).json({ ok: false, message: 'Cashier id and PIN are required.' })
      return
    }
    const pinSalt = randomSalt()
    const pinHash = hashWithSalt(pin, pinSalt)
    const result = await updateCashierPin(id, pin, pinSalt, pinHash)
    if (!result) {
      res.status(404).json({ ok: false, message: 'Cashier not found.' })
      return
    }
    res.status(200).json({ ok: true, cashier: result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ ok: false, message })
  }
}

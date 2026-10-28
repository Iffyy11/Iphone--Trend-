import { hasAdmin } from '../_lib/db.mjs'

export default async function handler(_req, res) {
  try {
    res.status(200).json({ ok: true, hasAdmin: await hasAdmin() })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(503).json({ ok: false, message })
  }
}

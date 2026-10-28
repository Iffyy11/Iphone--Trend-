import { createAdmin, hashWithSalt, normalizeEmail, randomSalt, readJson } from '../_lib/db.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ ok: false, message: 'Method not allowed' })
    return
  }

  try {
    const body = await readJson(req)
    const email = normalizeEmail(body.email)
    const password = String(body.password || '')
    if (!email || !password) {
      res.status(400).json({ ok: false, message: 'Email and password are required.' })
      return
    }

    const salt = randomSalt()
    const passwordHash = hashWithSalt(password, salt)
    const created = await createAdmin({ email, salt, passwordHash })
    if (!created) {
      res.status(409).json({ ok: false, message: 'Administrator already exists.' })
      return
    }
    res.status(200).json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ ok: false, message })
  }
}

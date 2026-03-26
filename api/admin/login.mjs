import { getDb, hashWithSalt, normalizeEmail, readJson } from '../_lib/db.mjs'

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

    const db = await getDb()
    const admin = await db.collection('admins').findOne({ email })
    if (!admin) {
      res.status(401).json({ ok: false })
      return
    }
    const passwordHash = hashWithSalt(password, admin.salt)
    if (passwordHash !== admin.passwordHash) {
      res.status(401).json({ ok: false })
      return
    }
    const staffName = email.split('@')[0] || 'Admin'
    res.status(200).json({ ok: true, staffName })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ ok: false, message })
  }
}

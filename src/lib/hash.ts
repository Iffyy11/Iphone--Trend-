/** Browser-native SHA-256 for local POS (not a substitute for server-side auth). */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function randomSalt(): string {
  const a = new Uint8Array(16)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashWithSalt(secret: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${secret}`)
}

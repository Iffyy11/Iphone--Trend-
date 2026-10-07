const API_BASE = import.meta.env.VITE_API_URL?.trim() || ''

function base(path: string): string {
  if (!API_BASE) return path
  return `${API_BASE.replace(/\/+$/, '')}${path}`
}

/** True when auth/cashiers go through the server API. Production (Vercel) serves /api same-origin. */
export function hasApiBase(): boolean {
  return Boolean(API_BASE) || import.meta.env.PROD
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(base(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const data = (await res.json().catch(() => ({}))) as T
  if (!res.ok) {
    throw new Error(`API ${res.status}`)
  }
  return data
}

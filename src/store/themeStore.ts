import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark'

function applyDom(theme: ThemeMode) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

interface ThemeState {
  theme: ThemeMode
  setTheme: (t: ThemeMode) => void
  toggle: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme(t) {
        set({ theme: t })
        applyDom(t)
      },
      toggle() {
        const n = get().theme === 'light' ? 'dark' : 'light'
        set({ theme: n })
        applyDom(n)
      },
    }),
    { name: 'iphone-trend-theme' },
  ),
)

export function initThemeFromStorage() {
  try {
    const raw = localStorage.getItem('iphone-trend-theme')
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { theme?: ThemeMode } }
      const t = parsed?.state?.theme
      if (t === 'dark' || t === 'light') {
        applyDom(t)
        return
      }
    }
  } catch {
    /* ignore */
  }
  applyDom('dark')
}

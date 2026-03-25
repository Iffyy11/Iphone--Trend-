import { useEffect } from 'react'
import { useThemeStore } from '../store/themeStore'

/** Keeps <html class="dark"> in sync with the theme store. */
export function ThemeSync() {
  const theme = useThemeStore((s) => s.theme)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  return null
}

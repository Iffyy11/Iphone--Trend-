import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '../store/themeStore'

/** Segmented Light / Dark switch. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const options = [
    { value: 'light', label: 'Light', Icon: Sun },
    { value: 'dark', label: 'Dark', Icon: Moon },
  ] as const
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={`inline-flex rounded-xl border border-line bg-subtle p-1 ${className}`}
    >
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => setTheme(value)}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            theme === value ? 'bg-surface text-fg shadow-card' : 'text-fg-muted hover:text-fg'
          }`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SHOP } from '../brand'
import { usePosStore } from '../store/posStore'
import { LogoMark } from './LogoMark'

/** No one signed in: back to the logo after this long. */
const IDLE_SIGNED_OUT_MS = 60 * 1000
/** Someone signed in: sign them out and show the logo after this long. */
const IDLE_SIGNED_IN_MS = 5 * 60 * 1000

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const

/** Full-screen logo shown on launch and after inactivity; any tap or key opens the login page. */
export function IdleScreen() {
  const navigate = useNavigate()
  const role = usePosStore((s) => s.session.role)
  const logout = usePosStore((s) => s.logout)
  const [showing, setShowing] = useState(true)
  const [now, setNow] = useState(() => new Date())
  const timer = useRef<number | undefined>(undefined)

  const wake = useCallback(() => {
    setShowing(false)
    navigate('/login', { replace: true })
  }, [navigate])

  // Inactivity timer — restarted by any user activity while the app is in use.
  useEffect(() => {
    if (showing) return
    const limit = role ? IDLE_SIGNED_IN_MS : IDLE_SIGNED_OUT_MS
    const arm = () => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        if (usePosStore.getState().session.role) logout()
        setShowing(true)
      }, limit)
    }
    arm()
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, arm, { passive: true }))
    return () => {
      window.clearTimeout(timer.current)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, arm))
    }
  }, [showing, role, logout])

  // While showing: any key wakes; keep the clock ticking.
  useEffect(() => {
    if (!showing) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      wake()
    }
    window.addEventListener('keydown', onKey)
    const tick = window.setInterval(() => setNow(new Date()), 15_000)
    setNow(new Date())
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearInterval(tick)
    }
  }, [showing, wake])

  if (!showing) return null

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Tap anywhere to start"
      onPointerDown={(e) => {
        e.preventDefault()
        wake()
      }}
      className="no-print fixed inset-0 z-[100] flex cursor-pointer select-none flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 px-6 text-white"
    >
      <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-24 h-[30rem] w-[30rem] rounded-full bg-indigo-400/20 blur-3xl" />

      <p className="absolute top-[max(2rem,env(safe-area-inset-top,0px))] text-sm font-medium tabular-nums text-blue-100/80">
        {now.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
        {now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
      </p>

      <div className="relative motion-safe:animate-float">
        <LogoMark
          size="xl"
          className="h-56 w-56 rounded-[2rem] shadow-2xl shadow-blue-950/50 ring-8 ring-white/20 sm:h-72 sm:w-72 lg:h-80 lg:w-80"
        />
      </div>

      <p className="relative mt-10 text-center text-sm text-blue-100/90 sm:text-base">{SHOP.gradeLine}</p>

      <p className="absolute bottom-[max(2.5rem,env(safe-area-inset-bottom,0px))] rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold backdrop-blur motion-safe:animate-pulse">
        Tap anywhere to start
      </p>
    </div>
  )
}

import { Download, Share, SquarePlus, X } from 'lucide-react'
import { useState } from 'react'
import { isIos, isStandalone, promptInstall, useCanPromptInstall } from '../lib/install'

/** "Install app" — native prompt on Chrome/Edge/Android, Add-to-Home-Screen steps on iPhone/iPad. */
export function InstallButton({ className = '' }: { className?: string }) {
  const canPrompt = useCanPromptInstall()
  const [showIosHelp, setShowIosHelp] = useState(false)

  if (isStandalone()) return null
  const ios = isIos()
  if (!canPrompt && !ios) return null

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => (canPrompt ? void promptInstall() : setShowIosHelp((v) => !v))}
        className="btn-secondary w-full"
      >
        <Download className="h-4 w-4" />
        Install app
      </button>
      {showIosHelp ? (
        <div className="card absolute bottom-full left-0 right-0 z-50 mb-2 p-4 text-sm shadow-pop">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold">Install on iPhone / iPad</p>
            <button
              type="button"
              onClick={() => setShowIosHelp(false)}
              className="icon-btn h-7 w-7"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ol className="space-y-2 text-fg-muted">
            <li className="flex items-center gap-2">
              <span className="font-semibold text-fg">1.</span> Tap
              <Share className="h-4 w-4 text-accent" /> <span className="text-fg">Share</span> in Safari
            </li>
            <li className="flex items-center gap-2">
              <span className="font-semibold text-fg">2.</span> Choose
              <SquarePlus className="h-4 w-4 text-accent" />
              <span className="text-fg">Add to Home Screen</span>
            </li>
          </ol>
        </div>
      ) : null}
    </div>
  )
}

import { Smartphone } from 'lucide-react'
import { useState } from 'react'

type Size = 'sm' | 'md' | 'lg'

const sizes: Record<Size, string> = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-20 w-20',
}

const iconSizes: Record<Size, string> = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-10 w-10',
}

export function LogoMark({
  size = 'sm',
  className = '',
}: {
  size?: Size
  className?: string
}) {
  const [ok, setOk] = useState(true)
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-900 text-white shadow-md ring-2 ring-brand-pink/35 ${sizes[size]} ${className}`}
    >
      {ok ? (
        <img
          src="/logo.png"
          alt=""
          className="h-full w-full object-cover"
          onError={() => setOk(false)}
        />
      ) : (
        <Smartphone className={iconSizes[size]} aria-hidden />
      )}
    </div>
  )
}

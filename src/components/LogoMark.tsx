import { Smartphone } from 'lucide-react'
import { useState } from 'react'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const sizes: Record<Size, string> = {
  xs: 'h-8 w-8',
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-20 w-20',
  xl: 'h-40 w-40 sm:h-48 sm:w-48',
}

const iconSizes: Record<Size, string> = {
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-10 w-10',
  xl: 'h-16 w-16',
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
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-slate-900 shadow-card ring-1 ring-line ${sizes[size]} ${className}`}
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

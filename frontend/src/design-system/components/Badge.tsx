import type { HTMLAttributes } from 'react'
import { cn } from '../cn'

type Tone = 'terracota' | 'oliva' | 'aubergine' | 'neutral'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

const toneClasses: Record<Tone, string> = {
  terracota: 'bg-terracota-50 text-terracota-600 border-terracota-100',
  oliva: 'bg-oliva-50 text-oliva-600 border-oliva-100',
  aubergine: 'bg-aubergine/5 text-aubergine border-aubergine/10',
  neutral: 'bg-surface-muted text-ink-soft border-border',
}

export function Badge({ tone = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 border px-3 py-1 text-xs font-semibold',
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

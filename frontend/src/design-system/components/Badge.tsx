import type { HTMLAttributes } from 'react'
import { cn } from '../cn'

/** Tons de marca para rótulos editoriais; `success`, `warning` e `danger` para status. */
export type BadgeTone = 'terracota' | 'oliva' | 'aubergine' | 'neutral' | 'success' | 'warning' | 'danger'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

const toneClasses: Record<BadgeTone, string> = {
  terracota: 'bg-terracota-50 text-terracota-600 border-terracota-100',
  oliva: 'bg-oliva-50 text-oliva-600 border-oliva-100',
  aubergine: 'bg-aubergine/5 text-aubergine border-aubergine/10',
  neutral: 'bg-surface-muted text-ink-soft border-border',
  success: 'bg-success/10 text-success border-success/30',
  // O amarelo de aviso não tem contraste AA como texto; o texto fica em aubergine.
  warning: 'bg-warning/15 text-aubergine border-warning/50',
  danger: 'bg-danger/10 text-danger border-danger/30',
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

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../cn'

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  /** Próximo passo para o usuário (ex.: `ButtonLink` "Ver vitrine"). */
  action?: ReactNode
  className?: string
}

/** Lista ou área sem conteúdo ainda: explica o motivo e aponta o próximo passo. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 border border-dashed border-border px-6 py-14 text-center',
        className,
      )}
    >
      {Icon && <Icon className="h-10 w-10 text-ink-soft/60" aria-hidden="true" />}
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium text-ink">{title}</p>
        {description && <p className="text-sm text-ink-soft">{description}</p>}
      </div>
      {action}
    </div>
  )
}

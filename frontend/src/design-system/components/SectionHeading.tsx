import type { ReactNode } from 'react'
import { cn } from '../cn'

export interface SectionHeadingProps {
  title: ReactNode
  description?: ReactNode
  align?: 'left' | 'center'
  action?: ReactNode
  className?: string
}

export function SectionHeading({ title, description, align = 'left', action, className }: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        align === 'center' && 'sm:flex-col sm:items-center sm:text-center',
        className,
      )}
    >
      <div className={cn('flex flex-col gap-2', align === 'center' && 'items-center')}>
        <h2 className="text-3xl font-semibold sm:text-4xl">{title}</h2>
        {description && <p className="max-w-2xl text-base text-ink-soft">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

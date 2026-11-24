import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../cn'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

/** Filtro selecionável, usado na barra de técnicas e filtros da vitrine (RF-CAT-02). */
export function Chip({ active = false, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'shrink-0 cursor-pointer border px-4 py-2 text-sm font-medium transition-colors duration-150',
        active
          ? 'border-terracota bg-terracota text-creme-50'
          : 'border-border bg-surface text-ink-soft hover:border-terracota-400 hover:text-terracota-600',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

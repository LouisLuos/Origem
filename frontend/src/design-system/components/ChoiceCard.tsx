import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../cn'

export interface ChoiceCardProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  type?: 'radio' | 'checkbox'
  label: ReactNode
  description?: ReactNode
  /** Elemento à direita do texto (ex.: ícone ou preço). */
  aside?: ReactNode
}

/**
 * Opção clicável em formato de cartão (forma de pagamento, endereço salvo, motivo).
 * Agrupe as opções de rádio com o mesmo `name` dentro de um `fieldset` com `legend`.
 */
export function ChoiceCard({ type = 'radio', label, description, aside, checked, disabled, className, ...props }: ChoiceCardProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 border bg-surface px-4 py-3 text-sm transition-colors',
        checked ? 'border-terracota' : 'border-border hover:border-ink-soft/50',
        disabled && 'cursor-not-allowed opacity-50 hover:border-border',
        className,
      )}
    >
      <input
        type={type}
        checked={checked}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 accent-terracota"
        {...props}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="text-ink-soft">{description}</span>}
      </span>
      {aside}
    </label>
  )
}

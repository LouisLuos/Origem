import { forwardRef, useId } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { cn } from '../cn'
import { FieldMessages, fieldDescribedBy } from './FieldMessages'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  hideLabel?: boolean
  hint?: string
  error?: string | null
}

/** Lista de opções com o mesmo visual do `Input`; passe as `<option>` como filhos. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hideLabel = false, hint, error, id, className, children, ...props },
  ref,
) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const messageId = `${selectId}-message`

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={selectId}
        className={cn('text-sm font-medium text-ink-soft', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(messageId, hint, error)}
        className={cn(
          'w-full cursor-pointer border border-border bg-surface px-5 py-2.5 text-base text-ink transition-colors focus:border-terracota',
          error && 'border-danger',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <FieldMessages id={messageId} hint={hint} error={error} />
    </div>
  )
})

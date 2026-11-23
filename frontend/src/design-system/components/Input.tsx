import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '../cn'
import { FieldMessages, fieldDescribedBy } from './FieldMessages'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hideLabel?: boolean
  hint?: string
  error?: string | null
}

/** Campo de texto acessível: todo input tem <label> associado (visível ou apenas para leitor de tela). */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hideLabel = false, hint, error, id, className, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const messageId = `${inputId}-message`

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className={cn('text-sm font-medium text-ink-soft', hideLabel && 'sr-only')}
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(messageId, hint, error)}
        className={cn(
          'w-full border border-border bg-surface px-5 py-3 text-base text-ink placeholder:text-ink-soft/60 transition-colors focus:border-terracota',
          error && 'border-danger',
          className,
        )}
        {...props}
      />
      <FieldMessages id={messageId} hint={hint} error={error} />
    </div>
  )
})

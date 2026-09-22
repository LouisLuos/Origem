import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '../cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hideLabel?: boolean
}

/** Campo de texto acessível: todo input tem <label> associado (visível ou apenas para leitor de tela). */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hideLabel = false, id, className, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

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
        className={cn(
          'w-full rounded-full border border-border bg-surface px-5 py-3 text-base text-ink placeholder:text-ink-soft/60 transition-colors focus:border-terracota',
          className,
        )}
        {...props}
      />
    </div>
  )
})

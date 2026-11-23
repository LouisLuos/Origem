import { forwardRef, useId } from 'react'
import type { TextareaHTMLAttributes } from 'react'
import { cn } from '../cn'
import { FieldMessages, fieldDescribedBy } from './FieldMessages'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  hideLabel?: boolean
  hint?: string
  error?: string | null
}

/** Texto longo (descrição, biografia, relato de avaria) com o mesmo visual do `Input`. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hideLabel = false, hint, error, id, className, rows = 4, ...props },
  ref,
) {
  const generatedId = useId()
  const textareaId = id ?? generatedId
  const messageId = `${textareaId}-message`

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={textareaId}
        className={cn('text-sm font-medium text-ink-soft', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(messageId, hint, error)}
        className={cn(
          'w-full border border-border bg-surface px-5 py-2.5 text-base text-ink placeholder:text-ink-soft/60 transition-colors focus:border-terracota',
          error && 'border-danger',
          className,
        )}
        {...props}
      />
      <FieldMessages id={messageId} hint={hint} error={error} />
    </div>
  )
})

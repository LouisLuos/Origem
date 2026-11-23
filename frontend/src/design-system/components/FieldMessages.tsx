export interface FieldMessagesProps {
  id: string
  hint?: string
  error?: string | null
}

/** Texto de ajuda e mensagem de erro sob um campo; o `id` alimenta `aria-describedby`. */
export function FieldMessages({ id, hint, error }: FieldMessagesProps) {
  if (error) {
    return (
      <span id={id} role="alert" className="text-xs text-danger">
        {error}
      </span>
    )
  }
  if (hint) {
    return (
      <span id={id} className="text-xs text-ink-soft">
        {hint}
      </span>
    )
  }
  return null
}

export function fieldDescribedBy(id: string, hint?: string, error?: string | null) {
  return hint || error ? id : undefined
}

import { Button } from '@/design-system'

/** Estado de carregamento acessível (anunciado por leitores de tela). */
export function LoadingBlock({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-16 text-sm text-ink-soft">
      <span
        aria-hidden="true"
        className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-terracota"
      />
      {label}
    </div>
  )
}

/** Estado de erro com opção de tentar de novo. */
export function ErrorBlock({ message, onRetry }: { message?: string | null; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 border border-dashed border-border py-12 text-center">
      <p className="text-base font-medium text-ink">Não foi possível carregar os dados</p>
      {message && <p className="text-sm text-ink-soft">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}

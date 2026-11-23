import { Button, Container } from '@/design-system'

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

/**
 * Espaçamento vertical da página enquanto o recurso não está pronto.
 * - `page`: telas com cabeçalho de página (painéis, checkout, confirmação).
 * - `detail`: telas de detalhe (peça e perfil do artesão).
 */
const resourceGateSpacing = {
  page: 'pb-16 pt-24 sm:pb-24 sm:pt-28',
  detail: 'pb-24 pt-32',
} as const

interface ResourceGateProps {
  /** Estado não pronto do recurso: exibe o carregamento ou o erro. */
  status: 'loading' | 'error'
  /** Texto anunciado durante o carregamento. */
  label?: string
  /** Mensagem do erro, quando houver. */
  error?: string | null
  /** Ação do botão "Tentar novamente". */
  onRetry?: () => void
  spacing?: keyof typeof resourceGateSpacing
}

/**
 * Página inteira de "carregando / erro" usada pelas views antes de o recurso ficar pronto.
 * Centraliza o invólucro `<main>` + `<Container>` que antes era repetido em cada tela (CS-12).
 */
export function ResourceGate({ status, label, error, onRetry, spacing = 'page' }: ResourceGateProps) {
  return (
    <main id="main-content" className={resourceGateSpacing[spacing]}>
      <Container>
        {status === 'error' ? <ErrorBlock message={error} onRetry={onRetry} /> : <LoadingBlock label={label} />}
      </Container>
    </main>
  )
}

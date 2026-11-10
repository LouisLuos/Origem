/** Mensagem de um erro capturado, para mostrar na tela. */
export function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback
}

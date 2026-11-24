/** Simula latência para avaliações locais estáticas de depoimentos. */
export function simulateLatency(ms = 300) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

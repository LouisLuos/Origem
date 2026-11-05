/**
 * Persistência da "Fake API": os dados vivem no localStorage do navegador.
 * Quando houver backend, os services deixam de usar isto e passam a chamar `fetch`.
 */
export function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeStorage(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Armazenamento indisponível (ex.: modo privado): os dados valem só até recarregar.
  }
}

export function removeStorage(key: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignorado
  }
}

/** Simula o tempo de resposta de uma requisição de rede. */
export function simulateLatency(ms = 300) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

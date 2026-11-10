const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

/**
 * Chamada à API do Origem. Rejeita com `Error` e mensagem em português: a enviada pelo servidor
 * (`{ "erro": "..." }`) ou `fallbackError`.
 */
export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
  fallbackError = 'Não foi possível concluir a operação.',
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { erro?: string } | null
    throw new Error(payload?.erro ?? fallbackError)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

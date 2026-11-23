const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    if (code !== undefined) {
      this.code = code
    }
  }
}

export function isApiError(reason: unknown): reason is ApiError {
  return reason instanceof ApiError
}

/**
 * Chamada à API do Origem. Rejeita com `ApiError` (preservando status HTTP e código opcional
 * do servidor) e mensagem em português enviada pelo servidor (`{ "erro": "..." }`) ou `fallbackError`.
 */
export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
  fallbackError = 'Não foi possível concluir a operação.',
): Promise<T> {
  const headers = new Headers(options?.headers)
  if (!headers.has('Content-Type') && !(options?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: options?.credentials ?? 'include',
      headers,
    })
  } catch {
    throw new ApiError(
      'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      0,
      'REDE_INDISPONIVEL',
    )
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      erro?: string
      codigo?: string
    } | null
    throw new ApiError(payload?.erro ?? fallbackError, response.status, payload?.codigo)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

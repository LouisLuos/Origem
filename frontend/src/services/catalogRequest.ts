import { apiRequest } from './api'

export function catalogRequest<T>(path: string, options?: RequestInit) {
  return apiRequest<T>(path, options, 'Não foi possível concluir a operação no catálogo.')
}

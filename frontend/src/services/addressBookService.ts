import { apiRequest } from './api'

/** Deve acompanhar `LIMITE_ENDERECOS_COMPRADOR` em backend/src/services/enderecoComprador.service.ts. */
export const ADDRESS_BOOK_LIMIT = 5

export interface SavedAddressPayload {
  cep: string
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  uf: string
}

export interface SavedAddress extends SavedAddressPayload {
  id: string
  criadoEm: string
}

/** Livro de endereços de entrega do comprador (HU-11). */
export const addressBookService = {
  async list(): Promise<SavedAddress[]> {
    const { dados } = await apiRequest<{ dados: SavedAddress[] }>(
      '/enderecos',
      {},
      'Não foi possível carregar seus endereços.',
    )
    return dados
  },

  async create(payload: SavedAddressPayload): Promise<SavedAddress> {
    return apiRequest<SavedAddress>(
      '/enderecos',
      { method: 'POST', body: JSON.stringify(payload) },
      'Não foi possível salvar o endereço.',
    )
  },

  async update(id: string, payload: SavedAddressPayload): Promise<SavedAddress> {
    return apiRequest<SavedAddress>(
      `/enderecos/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      'Não foi possível atualizar o endereço.',
    )
  },

  async remove(id: string): Promise<void> {
    await apiRequest<void>(
      `/enderecos/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      'Não foi possível remover o endereço.',
    )
  },
}

export function formatCep(cep: string): string {
  return cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')
}

export function formatAddressLine(address: SavedAddressPayload): string {
  const complemento = address.complemento ? `, ${address.complemento}` : ''
  return `${address.logradouro}, ${address.numero}${complemento} · ${address.bairro}`
}

import { apiRequest, isApiError } from './api'

/**
 * Polos culturais homologados para o cadastro de ateliê. Deve permanecer idêntica a
 * `POLOS_CULTURAIS_HOMOLOGADOS` em backend/src/constants/taxonomy.ts.
 */
export const atelierCulturalHubs = [
  'Caruaru',
  'Alto do Moura',
  'Nazaré da Mata',
  'Tracunhaém',
  'Bezerros',
  'Garanhuns',
  'Pesqueira',
  'Goiana',
  'Passira',
] as const

export interface AtelierAddressPayload {
  cep: string
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  uf: string
}

export interface CreateAtelierPayload {
  nomeComercial: string
  poloCultural: string
  endereco: AtelierAddressPayload
}

export interface CreatedAtelier {
  id: string
  nomeComercial: string
  poloCultural: string
  status: 'ATIVO' | 'SUSPENSO'
}

export interface AtelierDetails extends CreatedAtelier {
  artesaoId: string
  endereco: AtelierAddressPayload
  criadoEm: string
}

export const atelierService = {
  /** : cadastra ateliê e endereço de expedição em uma única operação no servidor. */
  async create(payload: CreateAtelierPayload): Promise<CreatedAtelier> {
    return apiRequest<CreatedAtelier>(
      '/atelies',
      { method: 'POST', body: JSON.stringify(payload) },
      'Não foi possível cadastrar o ateliê.',
    )
  },

  async get(atelieId: string): Promise<AtelierDetails> {
    return apiRequest<AtelierDetails>(
      `/atelies/${encodeURIComponent(atelieId)}`,
      {},
      'Não foi possível carregar os dados do ateliê.',
    )
  },

  async update(atelieId: string, payload: CreateAtelierPayload): Promise<AtelierDetails> {
    return apiRequest<AtelierDetails>(
      `/atelies/${encodeURIComponent(atelieId)}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      'Não foi possível atualizar o ateliê.',
    )
  },
}

export function atelierErrorMessage(reason: unknown): string {
  if (isApiError(reason) && reason.status === 401) {
    return 'Sua sessão não foi reconhecida pelo servidor. Entre novamente para continuar.'
  }
  return reason instanceof Error ? reason.message : 'Não foi possível cadastrar o ateliê.'
}

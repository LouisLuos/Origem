import type { PixKeyType } from '@/utils/pixKey'
import { apiRequest, isApiError } from './api'

export type AtelierOperation =
  | 'EDITAR_DADOS_ATELIE'
  | 'ALTERAR_CHAVE_PIX'
  | 'CONSULTAR_DADOS_FINANCEIROS'
  | 'GERENCIAR_CURADORES'
  | 'GERENCIAR_CATALOGO'
  | 'GERENCIAR_ETIQUETAS'

export type AtelierRole = 'TITULAR' | 'CURADOR'
export type AtelierStatus = 'ATIVO' | 'SUSPENSO'
export type DictVerificationStatus = 'NAO_VERIFICADA_LOCALMENTE' | 'VERIFICADA_DICT'

export interface AtelierAccessContext {
  readonly atelieId: string
  readonly nomeComercial?: string
  readonly statusAtelie: AtelierStatus
  readonly papelNoAtelie: AtelierRole
  readonly permissoes: readonly AtelierOperation[]
}

export interface EnableArtisanPayload {
  readonly biografiaCultural: string
  readonly chavePix: string
  readonly tipoChavePix?: PixKeyType
}

export interface EnableArtisanResponse {
  readonly artesaoId: string
  readonly usuarioId: string
  readonly biografiaCultural: string
  readonly papelAssociado: 'ARTESAO'
  readonly chavePix: {
    readonly tipo: PixKeyType
    readonly mascarada: string
    readonly verificacaoDict: DictVerificationStatus
  }
  readonly criadoEm?: string
}

export interface AtelierFinancialSummary {
  readonly atelieId: string
  readonly artesaoId: string
  readonly chavePix: {
    readonly cadastrada: true
    readonly tipo: PixKeyType
    readonly mascarada: string
    readonly verificacaoDict: DictVerificationStatus
  }
  readonly atualizadoEm?: string
}

export interface UpdatePixKeyPayload {
  readonly chavePix: string
  readonly tipoChavePix?: PixKeyType
}

export interface UpdatePixKeyResponse {
  readonly atelieId: string
  readonly artesaoId: string
  readonly chavePix: {
    readonly tipo: PixKeyType
    readonly mascarada: string
    readonly verificacaoDict: DictVerificationStatus
  }
  readonly atualizadoEm: string
}

export interface CuratorLink {
  readonly vinculoId: string
  readonly atelieId: string
  readonly usuarioId: string
  readonly nome: string
  readonly email: string
  readonly papelNoAtelie: 'CURADOR'
  readonly permissoes: readonly AtelierOperation[]
  readonly criadoEm: string
}

export type GovernanceErrorKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'auth_unavailable'
  | 'persistence_unavailable'
  | 'conflict'
  | 'validation'
  | 'not_found'
  | 'network'
  | 'unknown'

export interface ClassifiedGovernanceError {
  readonly kind: GovernanceErrorKind
  readonly status: number
  readonly code?: string
  readonly message: string
}

export function classifyGovernanceError(
  reason: unknown,
  fallbackMessage = 'Não foi possível concluir a operação.',
): ClassifiedGovernanceError {
  if (!isApiError(reason)) {
    return {
      kind: 'unknown',
      status: 500,
      message: reason instanceof Error ? reason.message : fallbackMessage,
    }
  }

  const { status, code, message } = reason

  if (status === 0 || code === 'REDE_INDISPONIVEL') {
    return { kind: 'network', status: 0, code, message }
  }

  if (status === 401) {
    return {
      kind: 'unauthenticated',
      status,
      code,
      message:
        'Sessão não autenticada no servidor. É necessária a integração real de autenticação para esta operação.',
    }
  }

  if (status === 403) {
    return { kind: 'forbidden', status, code, message }
  }

  if (status === 503) {
    if (code === 'AUTENTICACAO_INDISPONIVEL') {
      return {
        kind: 'auth_unavailable',
        status,
        code,
        message:
          'Autenticação oficial do servidor ainda indisponível. Nenhuma operação foi executada.',
      }
    }

    return {
      kind: 'persistence_unavailable',
      status,
      code,
      message:
        'Persistência em banco de dados ainda indisponível. Nenhuma alteração foi salva.',
    }
  }

  if (status === 409) {
    return { kind: 'conflict', status, code, message }
  }

  if (status === 404) {
    return { kind: 'not_found', status, code, message }
  }

  if (status === 400 || status === 422) {
    return { kind: 'validation', status, code, message }
  }

  return { kind: 'unknown', status, code, message }
}

/**
 * Integração HTTP real com os endpoints de governança da .
 * Não utiliza tokens fictícios, localStorage ou simulações de sucesso.
 */
export const atelierGovernanceService = {
  async enableArtisan(payload: EnableArtisanPayload): Promise<EnableArtisanResponse> {
    return apiRequest<EnableArtisanResponse>(
      '/artesaos/habilitacao',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      'Não foi possível concluir sua habilitação como artesão titular.',
    )
  },

  async listMyAtelierLinks(): Promise<AtelierAccessContext[]> {
    const response = await apiRequest<{ dados: AtelierAccessContext[] }>(
      '/atelies/meus-vinculos',
      undefined,
      'Não foi possível consultar seus vínculos de ateliê.',
    )
    return response.dados
  },

  async getFinancialSummary(atelieId: string): Promise<AtelierFinancialSummary> {
    return apiRequest<AtelierFinancialSummary>(
      `/atelies/${encodeURIComponent(atelieId)}/financeiro`,
      undefined,
      'Não foi possível consultar os dados financeiros do ateliê.',
    )
  },

  async updatePixKey(
    atelieId: string,
    payload: UpdatePixKeyPayload,
  ): Promise<UpdatePixKeyResponse> {
    return apiRequest<UpdatePixKeyResponse>(
      `/atelies/${encodeURIComponent(atelieId)}/chave-pix`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      'Não foi possível atualizar a Chave Pix do ateliê.',
    )
  },

  async listCurators(atelieId: string): Promise<CuratorLink[]> {
    const response = await apiRequest<{ dados: CuratorLink[] }>(
      `/atelies/${encodeURIComponent(atelieId)}/curadores`,
      undefined,
      'Não foi possível listar os curadores vinculados ao ateliê.',
    )
    return response.dados
  },

  async associateCurator(atelieId: string, email: string): Promise<CuratorLink> {
    return apiRequest<CuratorLink>(
      `/atelies/${encodeURIComponent(atelieId)}/curadores`,
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
      'Não foi possível vincular o curador informado.',
    )
  },

  async removeCurator(atelieId: string, curadorUsuarioId: string): Promise<void> {
    await apiRequest<void>(
      `/atelies/${encodeURIComponent(atelieId)}/curadores/${encodeURIComponent(curadorUsuarioId)}`,
      { method: 'DELETE' },
      'Não foi possível remover o vínculo do curador.',
    )
  },
}

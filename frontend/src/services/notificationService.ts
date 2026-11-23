import { apiRequest } from './api'

export type NotificationChannel = 'EMAIL' | 'WHATSAPP'

export type NotificationStatus =
  | 'ENFILEIRADA'
  | 'PROCESSANDO'
  | 'ENVIADA'
  | 'FALHA_TRANSITORIA'
  | 'FALHA_PERMANENTE'
  | 'IGNORADA'

/** Registro de um aviso enviado ao usuário (e-mail ou WhatsApp), com destinatário já mascarado. */
export interface SentNotification {
  id: string
  template: string
  canal: NotificationChannel
  status: NotificationStatus
  destinatario: string
  pedidoId: string | null
  erroCodigo: string | null
  criadoEm: string
  enviadoEm: string | null
}

export const NOTIFICATION_HISTORY_LIMIT = 50

/** Histórico dos avisos transacionais do usuário logado (HU-17). */
export const notificationService = {
  async listMine(): Promise<SentNotification[]> {
    const { dados } = await apiRequest<{ dados: SentNotification[] }>(
      `/notificacoes/minhas?limit=${NOTIFICATION_HISTORY_LIMIT}`,
      {},
      'Não foi possível carregar seus avisos.',
    )
    return dados
  },
}

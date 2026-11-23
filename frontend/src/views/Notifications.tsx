'use client'

import { useCallback, useEffect, useState } from 'react'
import { BellOff, Mail, MessageCircle } from 'lucide-react'
import { Navigate } from '@/components/Navigate'
import { LoadingBlock } from '@/components/AsyncState'
import { useAuth } from '@/context/AuthContext'
import { Alert, Badge, Button, ButtonLink, Container, EmptyState, SectionTitle } from '@/design-system'
import type { BadgeTone } from '@/design-system'
import {
  NOTIFICATION_HISTORY_LIMIT,
  notificationService,
  type NotificationStatus,
  type SentNotification,
} from '@/services/notificationService'
import { errorMessage } from '@/utils/errors'

const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })

const templateLabels: Record<string, string> = {
  PAGAMENTO_APROVADO_COMPRADOR: 'Pagamento aprovado',
  NOVA_ENCOMENDA_ATELIE: 'Nova encomenda para o seu ateliê',
  ALERTA_SLA_POSTAGEM_DIA5: 'Alerta de prazo de postagem',
  ATUALIZACAO_STATUS_PEDIDO: 'Atualização do pedido',
  RECUPERACAO_SENHA: 'Redefinição de senha',
}

const statusDisplay: Record<NotificationStatus, { label: string; tone: BadgeTone }> = {
  ENFILEIRADA: { label: 'Enviando', tone: 'neutral' },
  PROCESSANDO: { label: 'Enviando', tone: 'neutral' },
  ENVIADA: { label: 'Enviado', tone: 'success' },
  FALHA_TRANSITORIA: { label: 'Nova tentativa em breve', tone: 'warning' },
  FALHA_PERMANENTE: { label: 'Não entregue', tone: 'danger' },
  IGNORADA: { label: 'Não enviado', tone: 'neutral' },
}

const skipReasons: Record<string, string> = {
  WHATSAPP_SEM_CONSENTIMENTO: 'Você não autorizou avisos por WhatsApp.',
  TELEFONE_WHATSAPP_INVALIDO: 'O telefone cadastrado não é válido para WhatsApp.',
}

function NotificationItem({ notification }: { notification: SentNotification }) {
  const status = statusDisplay[notification.status] ?? { label: notification.status, tone: 'neutral' as const }
  const isEmail = notification.canal === 'EMAIL'
  const ChannelIcon = isEmail ? Mail : MessageCircle
  const skipReason = notification.status === 'IGNORADA' && notification.erroCodigo
    ? skipReasons[notification.erroCodigo]
    : undefined

  return (
    <li className="flex flex-col gap-3 border border-border bg-surface p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <ChannelIcon className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft" aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-0.5 text-sm">
          <p className="font-medium text-ink">{templateLabels[notification.template] ?? 'Aviso da plataforma'}</p>
          <p className="break-all text-ink-soft">
            {isEmail ? 'E-mail' : 'WhatsApp'} para {notification.destinatario}
          </p>
          <p className="text-ink-soft">
            <time dateTime={notification.criadoEm}>{dateTimeFormat.format(new Date(notification.criadoEm))}</time>
          </p>
          {skipReason && <p className="text-ink-soft">{skipReason}</p>}
        </div>
      </div>
      <Badge tone={status.tone} className="self-start">
        {status.label}
      </Badge>
    </li>
  )
}

/** Histórico de avisos enviados por e-mail e WhatsApp ao usuário logado (T17 · HU-17). */
export function Notifications() {
  const { user, hydrated } = useAuth()
  const [notifications, setNotifications] = useState<SentNotification[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setStatus('loading')
    setLoadError(null)
    try {
      setNotifications(await notificationService.listMine())
      setStatus('ready')
    } catch (reason) {
      setLoadError(errorMessage(reason, 'Não foi possível carregar seus avisos.'))
      setStatus('error')
    }
  }, [])

  const userId = user?.id
  useEffect(() => {
    if (userId) void load()
  }, [userId, load])

  if (!hydrated) return <LoadingBlock label="Verificando sessão…" />
  if (!user) return <Navigate to="/entrar?from=/notificacoes" />

  return (
    <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
      <Container className="max-w-3xl">
        <h1 className="pb-8 text-2xl font-semibold text-ink sm:text-3xl">Avisos</h1>

        <section aria-labelledby="notifications-title" className="flex flex-col gap-4">
          <SectionTitle
            id="notifications-title"
            description="E-mails e mensagens de WhatsApp que enviamos a você sobre pedidos, prazos e sua conta."
            action={
              status === 'ready' && notifications.length > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => void load()}>
                  Atualizar
                </Button>
              ) : undefined
            }
          >
            Histórico de avisos
          </SectionTitle>

          {status === 'loading' && <LoadingBlock label="Carregando avisos…" />}

          {status === 'error' && (
            <Alert
              tone="error"
              title="Não conseguimos carregar seus avisos."
              action={
                <Button variant="outline" size="sm" onClick={() => void load()}>
                  Tentar novamente
                </Button>
              }
            >
              {loadError}
            </Alert>
          )}

          {status === 'ready' && notifications.length === 0 && (
            <EmptyState
              icon={BellOff}
              title="Nenhum aviso enviado ainda"
              description="Quando houver novidades sobre seus pedidos ou sua conta, os avisos aparecem aqui."
              action={
                <ButtonLink href="/#vitrine" variant="primary" size="md">
                  Ver vitrine
                </ButtonLink>
              }
            />
          )}

          {status === 'ready' && notifications.length > 0 && (
            <>
              <ul className="flex flex-col gap-3">
                {notifications.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} />
                ))}
              </ul>
              {notifications.length >= NOTIFICATION_HISTORY_LIMIT && (
                <p className="text-sm text-ink-soft">
                  Mostrando os {NOTIFICATION_HISTORY_LIMIT} avisos mais recentes.
                </p>
              )}
            </>
          )}
        </section>
      </Container>
    </main>
  )
}

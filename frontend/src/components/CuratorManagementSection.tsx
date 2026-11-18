'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Trash2, UserPlus, Users } from 'lucide-react'
import { Badge, Button, Input } from '@/design-system'
import { LoadingBlock } from '@/components/AsyncState'
import {
  atelierGovernanceService,
  classifyGovernanceError,
  type AtelierOperation,
  type ClassifiedGovernanceError,
  type CuratorLink,
} from '@/services/atelierGovernanceService'
import { validateCuratorEmailClient } from '@/utils/pixKey'

interface CuratorManagementSectionProps {
  readonly atelieId: string
  readonly canManageCurators: boolean
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

const operationLabels: Record<AtelierOperation, string> = {
  ALTERAR_CHAVE_PIX: 'Chave Pix',
  CONSULTAR_DADOS_FINANCEIROS: 'Dados financeiros',
  GERENCIAR_CURADORES: 'Curadores',
  GERENCIAR_CATALOGO: 'Catálogo',
  GERENCIAR_ETIQUETAS: 'Etiquetas',
}

export function CuratorManagementSection({
  atelieId,
  canManageCurators,
}: CuratorManagementSectionProps) {
  const [curators, setCurators] = useState<CuratorLink[]>([])
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState<ClassifiedGovernanceError | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  const [email, setEmail] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [isAssociating, setIsAssociating] = useState(false)
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)

  useEffect(() => {
    if (!canManageCurators) {
      return
    }

    let cancelled = false
    async function loadCurators() {
      setLoadStatus('loading')
      setLoadError(null)
      try {
        const list = await atelierGovernanceService.listCurators(atelieId)
        if (cancelled) return
        setCurators(list)
        setLoadStatus('ready')
      } catch (reason) {
        if (cancelled) return
        setLoadError(
          classifyGovernanceError(reason, 'Não foi possível carregar os curadores do ateliê.'),
        )
        setLoadStatus('error')
      }
    }

    loadCurators()
    return () => {
      cancelled = true
    }
  }, [atelieId, canManageCurators, reloadTick])

  if (!canManageCurators) {
    return null
  }

  const handleAssociate = async (event: FormEvent) => {
    event.preventDefault()
    setActionError(null)
    setActionSuccess(null)

    const emailCheck = validateCuratorEmailClient(email)
    if (!emailCheck.valid) {
      setActionError(emailCheck.reason)
      return
    }

    setIsAssociating(true)
    try {
      const created = await atelierGovernanceService.associateCurator(
        atelieId,
        emailCheck.normalizedEmail,
      )
      setCurators((prev) => [created, ...prev])
      setEmail('')
      setActionSuccess(
        `Curador ${created.nome} (${created.email}) vinculado para catálogo e etiquetas.`,
      )
    } catch (reason) {
      setActionError(
        classifyGovernanceError(reason, 'Não foi possível vincular o curador.').message,
      )
    } finally {
      setIsAssociating(false)
    }
  }

  const handleRemove = async (curator: CuratorLink) => {
    if (!window.confirm(`Remover o vínculo de curadoria de ${curator.nome} (${curator.email})?`)) {
      return
    }

    setActionError(null)
    setActionSuccess(null)
    setRemovingUserId(curator.usuarioId)
    try {
      await atelierGovernanceService.removeCurator(atelieId, curator.usuarioId)
      setCurators((prev) => prev.filter((item) => item.usuarioId !== curator.usuarioId))
      setActionSuccess(`Vínculo de ${curator.nome} removido deste ateliê.`)
    } catch (reason) {
      setActionError(
        classifyGovernanceError(reason, 'Não foi possível remover o curador.').message,
      )
    } finally {
      setRemovingUserId(null)
    }
  }

  return (
    <section
      aria-labelledby="curators-management-title"
      className="flex flex-col gap-6 border border-border bg-surface p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Governança do ateliê (T-ART-04)
          </p>
          <h2 id="curators-management-title" className="pt-1 text-xl font-semibold text-ink">
            Equipe de curadores operacionais
          </h2>
        </div>
        <Badge tone="oliva">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          Sem acesso financeiro
        </Badge>
      </div>

      <p className="text-sm text-ink-soft">
        Associe apenas usuários ativos já cadastrados na plataforma pelo e-mail. Curadores podem
        operar <strong>Catálogo</strong> e <strong>Etiquetas</strong>, com acesso bloqueado à
        Chave Pix e aos repasses financeiros do titular.
      </p>

      <form onSubmit={handleAssociate} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label="E-mail do usuário ativo"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setActionError(null)
            }}
            placeholder="curador@email.com"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isAssociating}
          aria-busy={isAssociating}
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          {isAssociating ? 'Vinculando…' : 'Associar curador'}
        </Button>
      </form>

      {actionError && (
        <p role="alert" className="border border-danger/30 bg-surface-muted px-4 py-3 text-sm text-danger">
          {actionError}
        </p>
      )}

      {actionSuccess && (
        <p role="status" className="border border-oliva/30 bg-oliva-50 px-4 py-3 text-sm text-oliva-700">
          {actionSuccess}
        </p>
      )}

      {loadStatus === 'loading' && <LoadingBlock label="Carregando curadores vinculados…" />}

      {loadStatus === 'error' && loadError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-4 border border-danger/40 bg-surface-muted p-4 text-sm"
        >
          <div>
            <p className="font-semibold text-danger">
              Não foi possível listar curadores (HTTP{' '}
              {loadError.status === 0 ? 'Rede' : loadError.status})
            </p>
            <p className="pt-1 text-ink-soft">{loadError.message}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReloadTick((tick) => tick + 1)}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {loadStatus === 'ready' && curators.length === 0 && (
        <p className="border border-dashed border-border py-8 text-center text-sm text-ink-soft">
          Nenhum curador vinculado a este ateliê até o momento.
        </p>
      )}

      {loadStatus === 'ready' && curators.length > 0 && (
        <ul className="flex flex-col divide-y divide-border border border-border">
          {curators.map((curator) => {
            const isRemoving = removingUserId === curator.usuarioId
            return (
              <li
                key={curator.vinculoId}
                className="flex flex-wrap items-center justify-between gap-4 p-4"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{curator.nome}</span>
                    <Badge tone="aubergine">Curador</Badge>
                    {curator.permissoes.map((perm) => (
                      <Badge key={perm} tone="neutral">
                        {operationLabels[perm]}
                      </Badge>
                    ))}
                  </div>
                  <span className="text-xs text-ink-soft">
                    {curator.email} · Vinculado em {dateFormat.format(new Date(curator.criadoEm))}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isRemoving}
                  aria-busy={isRemoving}
                  aria-label={`Remover vínculo de ${curator.nome}`}
                  onClick={() => handleRemove(curator)}
                >
                  <Trash2 className="h-4 w-4 text-danger" aria-hidden="true" />
                  {isRemoving ? 'Removendo…' : 'Remover'}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

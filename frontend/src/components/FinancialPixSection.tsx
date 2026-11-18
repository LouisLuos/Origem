'use client'

import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Lock } from 'lucide-react'
import { Badge, Button, Input } from '@/design-system'
import { LoadingBlock } from '@/components/AsyncState'
import {
  atelierGovernanceService,
  classifyGovernanceError,
  type AtelierFinancialSummary,
  type ClassifiedGovernanceError,
} from '@/services/atelierGovernanceService'
import { PIX_KEY_TYPE_OPTIONS, validatePixKeyClient, type PixKeyType } from '@/utils/pixKey'

interface FinancialPixSectionProps {
  readonly atelieId: string
  readonly canViewFinancial: boolean
  readonly canUpdatePix: boolean
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const selectClass =
  'w-full border border-border bg-surface px-4 py-3 text-base text-ink transition-colors focus:border-terracota'

export function FinancialPixSection({
  atelieId,
  canViewFinancial,
  canUpdatePix,
}: FinancialPixSectionProps) {
  const typeSelectId = useId()
  const pixHintId = useId()

  const [summary, setSummary] = useState<AtelierFinancialSummary | null>(null)
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>(
    canViewFinancial ? 'loading' : 'ready',
  )
  const [loadError, setLoadError] = useState<ClassifiedGovernanceError | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  const [tipoChavePix, setTipoChavePix] = useState<PixKeyType>('CPF')
  const [novaChavePix, setNovaChavePix] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (!canViewFinancial) {
      return
    }

    let cancelled = false
    async function loadSummary() {
      setLoadStatus('loading')
      setLoadError(null)
      try {
        const data = await atelierGovernanceService.getFinancialSummary(atelieId)
        if (cancelled) return
        setSummary(data)
        setTipoChavePix(data.chavePix.tipo)
        setLoadStatus('ready')
      } catch (reason) {
        if (cancelled) return
        setLoadError(
          classifyGovernanceError(reason, 'Não foi possível carregar os dados financeiros.'),
        )
        setLoadStatus('error')
      }
    }

    loadSummary()
    return () => {
      cancelled = true
    }
  }, [atelieId, canViewFinancial, reloadTick])

  // Proteção em profundidade: jamais renderiza controles financeiros sem permissão confirmada pelo backend
  if (!canViewFinancial && !canUpdatePix) {
    return null
  }

  const selectedOption =
    PIX_KEY_TYPE_OPTIONS.find((opt) => opt.value === tipoChavePix) ?? PIX_KEY_TYPE_OPTIONS[0]

  const handleUpdatePix = async (event: FormEvent) => {
    event.preventDefault()
    if (!canUpdatePix) return

    setFormError(null)
    setSubmitSuccess(null)

    const validation = validatePixKeyClient(novaChavePix, tipoChavePix)
    if (!validation.valid) {
      setFormError(validation.reason)
      return
    }

    setIsUpdating(true)
    try {
      const updated = await atelierGovernanceService.updatePixKey(atelieId, {
        tipoChavePix,
        chavePix: validation.normalizedValue,
      })
      setNovaChavePix('')
      setSummary({
        atelieId: updated.atelieId,
        artesaoId: updated.artesaoId,
        chavePix: {
          cadastrada: true,
          tipo: updated.chavePix.tipo,
          mascarada: updated.chavePix.mascarada,
          verificacaoDict: updated.chavePix.verificacaoDict,
        },
        atualizadoEm: updated.atualizadoEm,
      })
      setLoadStatus('ready')
      setSubmitSuccess(
        `Chave Pix atualizada (${updated.chavePix.tipo}: ${updated.chavePix.mascarada}).`,
      )
    } catch (reason) {
      const classified = classifyGovernanceError(reason, 'Não foi possível atualizar a Chave Pix.')
      setFormError(classified.message)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <section
      aria-labelledby="financial-pix-title"
      className="flex flex-col gap-6 border border-border bg-surface p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Acesso restrito ao titular
          </p>
          <h2 id="financial-pix-title" className="pt-1 text-xl font-semibold text-ink">
            Chave Pix e dados financeiros protegidos
          </h2>
        </div>
        <Badge tone="terracota">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Invariante 5.5 ativa
        </Badge>
      </div>

      {canViewFinancial && loadStatus === 'loading' && (
        <LoadingBlock label="Consultando resumo financeiro no servidor…" />
      )}

      {canViewFinancial && loadStatus === 'error' && loadError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-4 border border-danger/40 bg-surface-muted p-4 text-sm"
        >
          <div>
            <p className="font-semibold text-danger">
              Falha ao consultar dados financeiros (HTTP{' '}
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

      {canViewFinancial && loadStatus === 'ready' && summary && (
        <div className="flex flex-col gap-2 border border-border bg-surface-muted p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink-soft">Chave cadastrada:</span>
            <Badge tone="neutral">{summary.chavePix.tipo}</Badge>
            <strong className="tracking-wide text-ink">{summary.chavePix.mascarada}</strong>
          </div>
          <p className="text-xs text-ink-soft">
            Verificação DICT: {summary.chavePix.verificacaoDict}
            {summary.atualizadoEm &&
              ` · Atualizada em ${dateFormat.format(new Date(summary.atualizadoEm))}`}
          </p>
          <p className="text-xs text-ink-soft">
            Por segurança, o backend nunca retorna o valor completo nem armazena a chave sem cifra
            AES-256-GCM.
          </p>
        </div>
      )}

      {canUpdatePix && (
        <form onSubmit={handleUpdatePix} noValidate className="flex flex-col gap-4 border-t border-border pt-5">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-ink">
            Atualizar Chave Pix do ateliê
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={typeSelectId} className="text-sm font-medium text-ink-soft">
                Novo tipo de Chave Pix
              </label>
              <select
                id={typeSelectId}
                value={tipoChavePix}
                onChange={(event) => {
                  setTipoChavePix(event.target.value as PixKeyType)
                  setFormError(null)
                }}
                className={selectClass}
              >
                {PIX_KEY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Input
                label="Nova Chave Pix"
                type="text"
                autoComplete="off"
                spellCheck={false}
                aria-describedby={pixHintId}
                value={novaChavePix}
                onChange={(event) => {
                  setNovaChavePix(event.target.value)
                  setFormError(null)
                }}
                placeholder={selectedOption.placeholder}
              />
              <p id={pixHintId} className="text-xs text-ink-soft">
                {selectedOption.hint}
              </p>
            </div>
          </div>

          {formError && (
            <p role="alert" className="border border-danger/30 bg-surface-muted px-4 py-3 text-sm text-danger">
              {formError}
            </p>
          )}

          {submitSuccess && (
            <p role="status" className="border border-oliva/30 bg-oliva-50 px-4 py-3 text-sm text-oliva-700">
              {submitSuccess}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isUpdating}
              aria-busy={isUpdating}
            >
              {isUpdating ? 'Atualizando Chave Pix…' : 'Atualizar Chave Pix'}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}

'use client'

import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Badge, Button, Input } from '@/design-system'
import {
  atelierGovernanceService,
  classifyGovernanceError,
  type ClassifiedGovernanceError,
  type EnableArtisanResponse,
} from '@/services/atelierGovernanceService'
import {
  BIOGRAFIA_MAX_LENGTH,
  BIOGRAFIA_MIN_LENGTH,
  PIX_KEY_TYPE_OPTIONS,
  validatePixKeyClient,
  type PixKeyType,
} from '@/utils/pixKey'

const selectClass =
  'w-full border border-border bg-surface px-4 py-3 text-base text-ink transition-colors focus:border-terracota'

export function ArtisanOnboardingForm() {
  const bioId = useId()
  const bioHintId = useId()
  const pixTypeId = useId()
  const pixHintId = useId()

  const [biografiaCultural, setBiografiaCultural] = useState('')
  const [tipoChavePix, setTipoChavePix] = useState<PixKeyType>('CPF')
  const [chavePix, setChavePix] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<ClassifiedGovernanceError | null>(null)
  const [confirmedResult, setConfirmedResult] = useState<EnableArtisanResponse | null>(null)

  const selectedOption =
    PIX_KEY_TYPE_OPTIONS.find((opt) => opt.value === tipoChavePix) ?? PIX_KEY_TYPE_OPTIONS[0]
  const trimmedBioLength = biografiaCultural.trim().length

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setClientError(null)
    setServerError(null)

    const bio = biografiaCultural.trim()
    if (bio.length < BIOGRAFIA_MIN_LENGTH) {
      setClientError(
        `A biografia cultural precisa ter ao menos ${BIOGRAFIA_MIN_LENGTH} caracteres.`,
      )
      return
    }
    if (bio.length > BIOGRAFIA_MAX_LENGTH) {
      setClientError(
        `A biografia cultural pode ter no máximo ${BIOGRAFIA_MAX_LENGTH} caracteres.`,
      )
      return
    }

    const pixCheck = validatePixKeyClient(chavePix, tipoChavePix)
    if (!pixCheck.valid) {
      setClientError(pixCheck.reason)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await atelierGovernanceService.enableArtisan({
        biografiaCultural: bio,
        tipoChavePix,
        chavePix: pixCheck.normalizedValue,
      })
      // Nunca manter Chave Pix em texto puro no estado nem gravar em storage do navegador
      setChavePix('')
      setConfirmedResult(result)
    } catch (reason) {
      setServerError(
        classifyGovernanceError(
          reason,
          'Não foi possível concluir a habilitação como artesão titular.',
        ),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section
      aria-labelledby="artisan-onboarding-title"
      className="border border-border bg-surface p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Governança do titular (HU-03)
          </p>
          <h2 id="artisan-onboarding-title" className="pt-1 text-xl font-semibold text-ink">
            Habilitação como artesão titular
          </h2>
        </div>
        <Badge tone="aubergine">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Chave Pix protegida no servidor
        </Badge>
      </div>

      <p className="pb-5 text-sm leading-relaxed text-ink-soft">
        Registre sua biografia cultural e a Chave Pix que receberá repasses como titular. A validação
        local confere apenas o formato DICT/BACEN; a confirmação real e o armazenamento
        criptografado acontecem exclusivamente no servidor (sem consulta externa automática ao DICT).
      </p>

      {confirmedResult ? (
        <div
          role="status"
          className="flex flex-col gap-3 border border-oliva/30 bg-oliva-50 p-4 text-sm text-ink"
        >
          <p className="font-semibold text-oliva-700">
            Habilitação confirmada pelo servidor.
          </p>
          <p>
            Papel associado: <strong>{confirmedResult.papelAssociado}</strong> · Chave Pix (
            {confirmedResult.chavePix.tipo}): <strong>{confirmedResult.chavePix.mascarada}</strong>
          </p>
          <p className="text-xs text-ink-soft">
            Status DICT: {confirmedResult.chavePix.verificacaoDict} · A parametrização física do
            ateliê e endereço de origem ocorre na etapa seguinte (HU-04).
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={bioId} className="text-sm font-medium text-ink-soft">
                Biografia cultural
              </label>
              <span id={bioHintId} className="text-xs text-ink-soft">
                {trimmedBioLength}/{BIOGRAFIA_MAX_LENGTH} caracteres (mín. {BIOGRAFIA_MIN_LENGTH})
              </span>
            </div>
            <textarea
              id={bioId}
              aria-describedby={bioHintId}
              rows={4}
              value={biografiaCultural}
              onChange={(event) => {
                setBiografiaCultural(event.target.value)
                setClientError(null)
              }}
              placeholder="Conte sua trajetória, região de origem em Pernambuco e técnica artesanal."
              className="w-full resize-y border border-border bg-surface px-4 py-3 text-base text-ink placeholder:text-ink-soft/60 transition-colors focus:border-terracota"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={pixTypeId} className="text-sm font-medium text-ink-soft">
                Tipo da Chave Pix
              </label>
              <select
                id={pixTypeId}
                value={tipoChavePix}
                onChange={(event) => {
                  setTipoChavePix(event.target.value as PixKeyType)
                  setClientError(null)
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
                label="Chave Pix do titular"
                type="text"
                autoComplete="off"
                spellCheck={false}
                aria-describedby={pixHintId}
                value={chavePix}
                onChange={(event) => {
                  setChavePix(event.target.value)
                  setClientError(null)
                }}
                placeholder={selectedOption.placeholder}
              />
              <p id={pixHintId} className="text-xs text-ink-soft">
                {selectedOption.hint}
              </p>
            </div>
          </div>

          {clientError && (
            <p role="alert" className="border border-danger/30 bg-surface-muted px-4 py-3 text-sm text-danger">
              {clientError}
            </p>
          )}

          {serverError && (
            <div
              role="alert"
              className="border border-danger/40 bg-surface-muted px-4 py-3 text-sm text-ink"
            >
              <p className="font-semibold text-danger">
                Não foi possível concluir a habilitação (HTTP{' '}
                {serverError.status === 0 ? 'Rede' : serverError.status})
              </p>
              <p className="pt-1 text-ink-soft">{serverError.message}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-ink-soft">
              A Chave Pix nunca é salva no navegador e trafega apenas na requisição oficial da API.
            </p>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Enviando solicitação…' : 'Solicitar habilitação'}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}

'use client'

import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Input } from '@/design-system'
import { addressService } from '@/services/addressService'
import {
  atelierCulturalHubs,
  atelierErrorMessage,
  atelierService,
  type AtelierDetails,
} from '@/services/atelierService'

interface AtelierSetupFormProps {
  /** Chamado após o servidor confirmar a criação ou atualização. */
  readonly onSaved: () => void
  readonly initialData?: AtelierDetails
  readonly onCancel?: () => void
}

type Field = 'nomeComercial' | 'poloCultural' | 'cep' | 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'uf'

const emptyForm: Record<Field, string> = {
  nomeComercial: '',
  poloCultural: atelierCulturalHubs[0],
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
}

const selectClass =
  'w-full border border-border bg-surface px-5 py-2.5 text-base text-ink transition-colors focus:border-terracota'

/** : criação ou edição do ateliê com endereço de expedição e busca automática por CEP. */
export function AtelierSetupForm({ onSaved, initialData, onCancel }: AtelierSetupFormProps) {
  const hubId = useId()
  const [form, setForm] = useState(() => initialData
    ? {
        nomeComercial: initialData.nomeComercial,
        poloCultural: initialData.poloCultural,
        cep: initialData.endereco.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2'),
        logradouro: initialData.endereco.logradouro,
        numero: initialData.endereco.numero,
        complemento: initialData.endereco.complemento ?? '',
        bairro: initialData.endereco.bairro,
        cidade: initialData.endereco.cidade,
        uf: initialData.endereco.uf,
      }
    : emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [cepStatus, setCepStatus] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lookupRef = useRef<AbortController | null>(null)
  const isEditing = Boolean(initialData)

  const setField = (field: Field) => (event: { target: { value: string } }) =>
    setForm((prev) => ({
      ...prev,
      [field]: field === 'cep'
        ? event.target.value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
        : event.target.value,
    }))

  const handleCepBlur = async () => {
    const digits = form.cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    lookupRef.current?.abort()
    const controller = new AbortController()
    lookupRef.current = controller
    setCepStatus('Buscando endereço…')
    try {
      const address = await addressService.lookup(digits, controller.signal)
      if (!address) {
        setCepStatus('CEP não encontrado. Preencha o endereço manualmente.')
        return
      }
      if (address.state.toUpperCase() !== 'PE') {
        setCepStatus('Apenas endereços de Pernambuco podem ser usados como origem do ateliê.')
        return
      }
      setForm((prev) => ({
        ...prev,
        logradouro: address.street || prev.logradouro,
        bairro: address.neighborhood || prev.bairro,
        cidade: address.city || prev.cidade,
        uf: address.state || prev.uf,
      }))
      setCepStatus(null)
    } catch {
      if (!controller.signal.aborted) setCepStatus('Não foi possível buscar o CEP. Preencha o endereço manualmente.')
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    const required: Array<[Field, string]> = [
      ['nomeComercial', 'o nome comercial'],
      ['logradouro', 'o logradouro'],
      ['numero', 'o número'],
      ['bairro', 'o bairro'],
      ['cidade', 'a cidade'],
    ]
    const missing = required.find(([field]) => !form[field].trim())
    if (missing) return setError(`Informe ${missing[1]}.`)
    if (form.cep.replace(/\D/g, '').length !== 8) return setError('Informe um CEP válido com 8 dígitos.')
    if (form.uf.trim().toUpperCase() !== 'PE') return setError('O endereço de expedição deve ser em Pernambuco (UF PE).')

    setIsSubmitting(true)
    try {
      const payload = {
        nomeComercial: form.nomeComercial.trim(),
        poloCultural: form.poloCultural,
        endereco: {
          cep: form.cep.replace(/\D/g, ''),
          logradouro: form.logradouro.trim(),
          numero: form.numero.trim(),
          ...(form.complemento.trim() ? { complemento: form.complemento.trim() } : {}),
          bairro: form.bairro.trim(),
          cidade: form.cidade.trim(),
          uf: form.uf.trim().toUpperCase(),
        },
      }
      if (initialData) {
        await atelierService.update(initialData.id, payload)
      } else {
        await atelierService.create(payload)
      }
      onSaved()
    } catch (reason) {
      setError(atelierErrorMessage(reason))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={isEditing ? 'Edição do ateliê' : 'Cadastro do ateliê'}
      className="flex flex-col gap-4 border border-border bg-aubergine-400/10 p-6"
    >
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink">
          {isEditing ? 'Edite os dados do ateliê' : 'Cadastre seu ateliê'}
        </h2>
        <p className="pt-1 text-sm text-ink-soft">
          {isEditing
            ? 'Atualize o nome, polo cultural ou endereço de expedição do seu ateliê.'
            : 'O ateliê identifica sua unidade produtiva e o CEP de saída usado no cálculo de frete. Ele é necessário para catalogar peças.'}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nome comercial" value={form.nomeComercial} onChange={setField('nomeComercial')} className="py-2.5" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={hubId} className="text-sm font-medium text-ink-soft">
            Polo cultural
          </label>
          <select id={hubId} value={form.poloCultural} onChange={setField('poloCultural')} className={selectClass}>
            {atelierCulturalHubs.map((hub) => (
              <option key={hub}>{hub}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Input
            label="CEP"
            inputMode="numeric"
            value={form.cep}
            onChange={setField('cep')}
            onBlur={handleCepBlur}
            placeholder="55000000"
            className="py-2.5"
          />
          {cepStatus && (
            <p role="status" className="text-xs text-ink-soft">
              {cepStatus}
            </p>
          )}
        </div>
        <Input label="Logradouro" value={form.logradouro} onChange={setField('logradouro')} className="py-2.5" />
        <Input label="Número" value={form.numero} onChange={setField('numero')} className="py-2.5" />
        <Input label="Complemento (opcional)" value={form.complemento} onChange={setField('complemento')} className="py-2.5" />
        <Input label="Bairro" value={form.bairro} onChange={setField('bairro')} className="py-2.5" />
        <Input label="Cidade" value={form.cidade} onChange={setField('cidade')} className="py-2.5" />
        <Input label="UF" value={form.uf} onChange={setField('uf')} maxLength={2} className="py-2.5" />
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting
              ? (isEditing ? 'Salvando…' : 'Cadastrando…')
              : (isEditing ? 'Salvar alterações' : 'Cadastrar ateliê')}
          </Button>
          {isEditing && onCancel && (
            <Button type="button" variant="outline" size="md" onClick={onCancel} disabled={isSubmitting}>
              Cancelar
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}

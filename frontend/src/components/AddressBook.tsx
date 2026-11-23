'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Input } from '@/design-system'
import { LoadingBlock } from '@/components/AsyncState'
import { addressService } from '@/services/addressService'
import {
  ADDRESS_BOOK_LIMIT,
  addressBookService,
  formatAddressLine,
  formatCep,
  type SavedAddress,
  type SavedAddressPayload,
} from '@/services/addressBookService'
import { errorMessage } from '@/utils/errors'

type Field = 'cep' | 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'uf'
type FormState = Record<Field, string>

const emptyForm: FormState = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
}

function toForm(address: SavedAddress): FormState {
  return {
    cep: formatCep(address.cep),
    logradouro: address.logradouro,
    numero: address.numero,
    complemento: address.complemento ?? '',
    bairro: address.bairro,
    cidade: address.cidade,
    uf: address.uf,
  }
}

function toPayload(form: FormState): SavedAddressPayload {
  return {
    cep: form.cep.replace(/\D/g, ''),
    logradouro: form.logradouro.trim(),
    numero: form.numero.trim(),
    ...(form.complemento.trim() ? { complemento: form.complemento.trim() } : {}),
    bairro: form.bairro.trim(),
    cidade: form.cidade.trim(),
    uf: form.uf.trim().toUpperCase(),
  }
}

/** Livro de endereços de entrega do comprador (HU-11). */
export function AddressBook() {
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState<'new' | string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [cepStatus, setCepStatus] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const lookupRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    setStatus('loading')
    setLoadError(null)
    try {
      setAddresses(await addressBookService.list())
      setStatus('ready')
    } catch (reason) {
      setLoadError(errorMessage(reason, 'Não foi possível carregar seus endereços.'))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const isFull = addresses.length >= ADDRESS_BOOK_LIMIT

  const openForm = (target: 'new' | SavedAddress) => {
    setFeedback(null)
    setFormError(null)
    setCepStatus(null)
    setConfirmingDelete(null)
    if (target === 'new') {
      setEditing('new')
      setForm(emptyForm)
    } else {
      setEditing(target.id)
      setForm(toForm(target))
    }
  }

  const closeForm = () => {
    lookupRef.current?.abort()
    setEditing(null)
    setFormError(null)
    setCepStatus(null)
  }

  const setField = (field: Field) => (event: { target: { value: string } }) =>
    setForm((prev) => ({
      ...prev,
      [field]:
        field === 'cep'
          ? event.target.value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
          : field === 'uf'
            ? event.target.value.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()
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
      const found = await addressService.lookup(digits, controller.signal)
      if (!found) {
        setCepStatus('CEP não encontrado. Preencha o endereço manualmente.')
        return
      }
      setForm((prev) => ({
        ...prev,
        logradouro: found.street || prev.logradouro,
        bairro: found.neighborhood || prev.bairro,
        cidade: found.city || prev.cidade,
        uf: found.state || prev.uf,
      }))
      setCepStatus(null)
    } catch {
      if (!controller.signal.aborted) {
        setCepStatus('Não foi possível buscar o CEP. Preencha o endereço manualmente.')
      }
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const required: Array<[Field, string]> = [
      ['logradouro', 'o logradouro'],
      ['numero', 'o número'],
      ['bairro', 'o bairro'],
      ['cidade', 'a cidade'],
    ]
    if (form.cep.replace(/\D/g, '').length !== 8) return setFormError('Informe um CEP válido com 8 dígitos.')
    const missing = required.find(([field]) => !form[field].trim())
    if (missing) return setFormError(`Informe ${missing[1]}.`)
    if (!/^[A-Z]{2}$/.test(form.uf.trim().toUpperCase())) return setFormError('Informe a UF com 2 letras (ex.: PE).')

    setIsSaving(true)
    try {
      if (editing === 'new') {
        const created = await addressBookService.create(toPayload(form))
        setAddresses((prev) => [...prev, created])
        setFeedback('Endereço adicionado.')
      } else if (editing) {
        const updated = await addressBookService.update(editing, toPayload(form))
        setAddresses((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
        setFeedback('Endereço atualizado.')
      }
      closeForm()
    } catch (reason) {
      setFormError(errorMessage(reason, 'Não foi possível salvar o endereço.'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setFeedback(null)
    try {
      await addressBookService.remove(id)
      setAddresses((prev) => prev.filter((item) => item.id !== id))
      setFeedback('Endereço removido. Pedidos já feitos com ele não são alterados.')
    } catch (reason) {
      setFeedback(errorMessage(reason, 'Não foi possível remover o endereço.'))
    } finally {
      setDeletingId(null)
      setConfirmingDelete(null)
    }
  }

  return (
    <section aria-labelledby="addresses-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="addresses-title" className="text-sm font-semibold uppercase tracking-widest text-ink">
            Meus endereços
          </h2>
          <p className="pt-1 text-sm text-ink-soft">
            Salve até {ADDRESS_BOOK_LIMIT} endereços de entrega para escolher com um clique no checkout.
          </p>
        </div>
        {status === 'ready' && !editing && !isFull && (
          <Button variant="outline" size="sm" onClick={() => openForm('new')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar endereço
          </Button>
        )}
      </div>

      {feedback && (
        <p role="status" className="text-sm text-oliva-600">
          {feedback}
        </p>
      )}

      {status === 'loading' && <LoadingBlock label="Carregando endereços…" />}

      {status === 'error' && (
        <div className="flex flex-wrap items-center gap-3 border border-border p-4">
          <p role="alert" className="text-sm text-danger">
            {loadError}
          </p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {status === 'ready' && isFull && !editing && (
        <p role="status" className="border border-border bg-surface p-3 text-sm text-ink-soft">
          Você atingiu o limite de {ADDRESS_BOOK_LIMIT} endereços. Para cadastrar outro, remova ou edite um
          endereço existente.
        </p>
      )}

      {status === 'ready' && addresses.length === 0 && !editing && (
        <div className="flex flex-col items-center gap-3 border border-dashed border-border py-10 text-center">
          <MapPin className="h-8 w-8 text-ink-soft/60" aria-hidden="true" />
          <p className="text-sm text-ink-soft">Você ainda não salvou nenhum endereço.</p>
        </div>
      )}

      {status === 'ready' && addresses.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="flex flex-col gap-3 border border-border bg-surface p-4">
              <div className="flex flex-col gap-0.5 text-sm">
                <span className="font-medium text-ink">{formatAddressLine(address)}</span>
                <span className="text-ink-soft">
                  {address.cidade}/{address.uf} · CEP {formatCep(address.cep)}
                </span>
              </div>
              {confirmingDelete === address.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-ink">Remover este endereço?</span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleDelete(address.id)}
                    disabled={deletingId === address.id}
                    aria-busy={deletingId === address.id}
                  >
                    {deletingId === address.id ? 'Removendo…' : 'Remover'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(null)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openForm(address)}
                    aria-label={`Editar ${formatAddressLine(address)}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingDelete(address.id)}
                    aria-label={`Remover ${formatAddressLine(address)}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remover
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-label={editing === 'new' ? 'Novo endereço' : 'Edição de endereço'}
          className="flex flex-col gap-4 border border-border bg-aubergine-400/10 p-6"
        >
          <h3 className="text-sm font-semibold uppercase tracking-widest text-ink">
            {editing === 'new' ? 'Novo endereço' : 'Editar endereço'}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Input
                label="CEP"
                inputMode="numeric"
                autoComplete="postal-code"
                value={form.cep}
                onChange={setField('cep')}
                onBlur={handleCepBlur}
                placeholder="50000-000"
                className="py-2.5"
              />
              {cepStatus && (
                <p role="status" className="text-xs text-ink-soft">
                  {cepStatus}
                </p>
              )}
            </div>
            <Input label="Logradouro" autoComplete="address-line1" value={form.logradouro} onChange={setField('logradouro')} className="py-2.5" />
            <Input label="Número" value={form.numero} onChange={setField('numero')} className="py-2.5" />
            <Input label="Complemento (opcional)" value={form.complemento} onChange={setField('complemento')} className="py-2.5" />
            <Input label="Bairro" value={form.bairro} onChange={setField('bairro')} className="py-2.5" />
            <Input label="Cidade" autoComplete="address-level2" value={form.cidade} onChange={setField('cidade')} className="py-2.5" />
            <Input label="UF" autoComplete="address-level1" value={form.uf} onChange={setField('uf')} maxLength={2} className="py-2.5" />
          </div>
          {formError && (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" size="md" disabled={isSaving} aria-busy={isSaving}>
              {isSaving ? 'Salvando…' : 'Salvar endereço'}
            </Button>
            <Button type="button" variant="outline" size="md" onClick={closeForm} disabled={isSaving}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}

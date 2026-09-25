import { useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff, Minus, Pencil, Plus, Trash2 } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { Button, Container, Input, cn, currency } from '@/design-system'
import { culturalHubs, techniques } from '@/design-system/tokens'
import { useAuth } from '@/context/AuthContext'
import { ErrorBlock, LoadingBlock } from '@/components/AsyncState'
import { useCatalog } from '@/context/CatalogContext'
import type { CatalogItem, CatalogItemInput } from '@/context/CatalogContext'

const LOW_STOCK = 3

interface FormState {
  title: string
  technique: string
  hub: string
  price: string
  stock: string
  imageUrl: string
  description: string
}

const emptyForm: FormState = {
  title: '',
  technique: techniques[0],
  hub: culturalHubs[0],
  price: '',
  stock: '1',
  imageUrl: '',
  description: '',
}

const selectClass =
  'w-full border border-border bg-surface px-5 py-2.5 text-base text-ink transition-colors focus:border-terracota'

function stockTone(stock: number) {
  if (stock === 0) return 'text-danger'
  if (stock <= LOW_STOCK) return 'text-warning'
  return 'text-ink'
}

export function ArtisanPanel() {
  const { user } = useAuth()
  const { items, status, error: loadError, reload, addItem, updateItem, adjustStock, removeItem } = useCatalog()
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (!user) return <Navigate to="/entrar" state={{ from: '/painel' }} replace />
  if (user.role !== 'artisan') return <Navigate to="/conta" replace />

  if (status !== 'ready') {
    return (
      <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
        <Container>
          {status === 'error' ? <ErrorBlock message={loadError} onRetry={reload} /> : <LoadingBlock label="Carregando catálogo…" />}
        </Container>
      </main>
    )
  }

  /** Executa uma operação do catálogo e mostra o erro, se houver. */
  const run = async (operation: () => Promise<void>) => {
    setActionError(null)
    try {
      await operation()
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Não foi possível concluir a operação.')
    }
  }

  const myItems = items.filter((item) => item.ownerEmail === user.email)
  const activeCount = myItems.filter((item) => item.active).length
  const totalUnits = myItems.reduce((total, item) => total + item.stock, 0)
  const lowStock = myItems.filter((item) => item.stock > 0 && item.stock <= LOW_STOCK).length
  const soldOut = myItems.filter((item) => item.stock === 0).length

  const openForm = (item?: CatalogItem) => {
    setError(null)
    setEditingId(item ? item.id : 'new')
    setForm(
      item
        ? {
            title: item.title,
            technique: item.technique,
            hub: item.hub,
            price: String(item.price),
            stock: String(item.stock),
            imageUrl: item.imageUrl,
            description: item.description ?? '',
          }
        : emptyForm,
    )
  }

  const closeForm = () => {
    setEditingId(null)
    setError(null)
  }

  const setField = (name: keyof FormState) => (event: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [name]: event.target.value }))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const price = Number(form.price.replace(',', '.'))
    const stock = Number(form.stock)
    if (!form.title.trim()) return setError('Informe o nome da peça.')
    if (!Number.isFinite(price) || price <= 0) return setError('Informe um preço maior que zero.')
    if (!Number.isInteger(stock) || stock < 0) return setError('O estoque deve ser um número inteiro (0 ou mais).')

    const data: CatalogItemInput = {
      title: form.title.trim(),
      technique: form.technique,
      hub: form.hub,
      price,
      stock,
      imageUrl:
        form.imageUrl.trim() ||
        `https://picsum.photos/seed/origem-${encodeURIComponent(form.title.trim())}/800/800`,
      imageAlt: form.title.trim(),
      description: form.description.trim(),
      active: true,
    }

    setIsSaving(true)
    try {
      if (editingId === 'new') {
        await addItem({ email: user.email, name: user.name }, data)
      } else if (editingId) {
        // Editar não altera se a peça está ativa ou pausada, nem o texto alternativo da foto (se a foto não mudou).
        const current = items.find((item) => item.id === editingId)
        await updateItem(editingId, {
          ...data,
          active: current?.active ?? true,
          imageAlt: current && current.imageUrl === data.imageUrl ? current.imageAlt : data.imageAlt,
        })
      }
      closeForm()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a peça.')
    } finally {
      setIsSaving(false)
    }
  }

  const summary = [
    { label: 'Peças ativas', value: activeCount },
    { label: 'Unidades em estoque', value: totalUnits },
    { label: 'Estoque baixo', value: lowStock },
    { label: 'Esgotadas', value: soldOut },
  ]

  return (
    <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4 pb-8">
          <div>
            <p className="text-sm text-ink-soft">Painel do artesão</p>
            <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Meu catálogo</h1>
          </div>
          <Button variant="primary" size="md" onClick={() => openForm()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova peça
          </Button>
        </div>

        <dl className="grid grid-cols-2 gap-4 pb-10 lg:grid-cols-4">
          {summary.map(({ label, value }) => (
            <div key={label} className="border border-border bg-aubergine-400/10 p-4">
              <dt className="text-xs uppercase tracking-widest text-ink-soft">{label}</dt>
              <dd className="pt-1 text-2xl font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        {editingId && (
          <form
            onSubmit={handleSubmit}
            noValidate
            aria-label={editingId === 'new' ? 'Nova peça' : 'Editar peça'}
            className="mb-10 flex flex-col gap-4 border border-border bg-aubergine-400/10 p-6"
          >
            <h2 className="text-sm font-semibold uppercase tracking-widest text-ink">
              {editingId === 'new' ? 'Nova peça' : 'Editar peça'}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input
                  label="Nome da peça"
                  value={form.title}
                  onChange={setField('title')}
                  placeholder="Boneco de Barro “Casal de Feira”"
                  className="py-2.5"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="panel-technique" className="text-sm font-medium text-ink-soft">
                  Técnica
                </label>
                <select id="panel-technique" value={form.technique} onChange={setField('technique')} className={selectClass}>
                  {techniques.map((technique) => (
                    <option key={technique}>{technique}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="panel-hub" className="text-sm font-medium text-ink-soft">
                  Polo cultural
                </label>
                <select id="panel-hub" value={form.hub} onChange={setField('hub')} className={selectClass}>
                  {culturalHubs.map((hub) => (
                    <option key={hub}>{hub}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Preço (R$)"
                inputMode="decimal"
                value={form.price}
                onChange={setField('price')}
                placeholder="189,00"
                className="py-2.5"
              />
              <Input
                label="Estoque (unidades)"
                type="number"
                min={0}
                step={1}
                value={form.stock}
                onChange={setField('stock')}
                className="py-2.5"
              />
              <div className="sm:col-span-2">
                <Input
                  label="URL da foto (opcional)"
                  type="url"
                  value={form.imageUrl}
                  onChange={setField('imageUrl')}
                  placeholder="https://…"
                  className="py-2.5"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="panel-description" className="text-sm font-medium text-ink-soft">
                  Descrição
                </label>
                <textarea
                  id="panel-description"
                  rows={3}
                  value={form.description}
                  onChange={setField('description')}
                  placeholder="Conte como a peça é feita, materiais e medidas."
                  className="w-full border border-border bg-surface px-5 py-2.5 text-base text-ink placeholder:text-ink-soft/60 transition-colors focus:border-terracota"
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <Button type="submit" variant="primary" size="md" disabled={isSaving} aria-busy={isSaving}>
                {isSaving ? 'Salvando…' : editingId === 'new' ? 'Cadastrar peça' : 'Salvar alterações'}
              </Button>
              <Button type="button" variant="outline" size="md" onClick={closeForm}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        <h2 className="pb-4 text-sm font-semibold uppercase tracking-widest text-ink">Peças e estoque</h2>

        {actionError && (
          <p role="alert" className="pb-4 text-sm text-danger">
            {actionError}
          </p>
        )}

        {myItems.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border border-dashed border-border py-14 text-center">
            <p className="text-base font-medium text-ink">Seu catálogo está vazio</p>
            <p className="text-sm text-ink-soft">Cadastre sua primeira peça para começar a controlar o estoque.</p>
            <Button variant="primary" size="md" onClick={() => openForm()}>
              Nova peça
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col">
            {myItems.map((item) => (
              <li
                key={item.id}
                className={cn(
                  'flex flex-wrap items-center gap-4 border-b border-border py-4 first:pt-0',
                  !item.active && 'opacity-60',
                )}
              >
                <img src={item.imageUrl} alt="" className="h-16 w-16 shrink-0 object-cover" />

                <div className="flex min-w-48 flex-1 flex-col">
                  <span className="font-medium text-ink">{item.title}</span>
                  <span className="text-xs text-ink-soft">
                    {item.technique} · {item.hub}
                  </span>
                  <span className="text-xs text-ink-soft">
                    {currency.format(item.price)}
                    {!item.active && ' · Pausada'}
                  </span>
                </div>

                <div className="flex flex-col items-start gap-1">
                  <div className="flex h-9 items-center border border-border">
                    <button
                      type="button"
                      onClick={() => run(() => adjustStock(item.id, -1))}
                      disabled={item.stock === 0}
                      aria-label={`Diminuir estoque de ${item.title}`}
                      className="flex h-full w-8 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-terracota-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <span aria-live="polite" className={cn('w-10 text-center text-sm font-semibold', stockTone(item.stock))}>
                      {item.stock}
                    </span>
                    <button
                      type="button"
                      onClick={() => run(() => adjustStock(item.id, 1))}
                      aria-label={`Aumentar estoque de ${item.title}`}
                      className="flex h-full w-8 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-terracota-600"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <span className={cn('text-[11px] uppercase tracking-widest', stockTone(item.stock))}>
                    {item.stock === 0 ? 'Esgotada' : item.stock <= LOW_STOCK ? 'Estoque baixo' : 'Em estoque'}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => run(() => updateItem(item.id, { active: !item.active }))}
                    aria-label={item.active ? `Pausar ${item.title}` : `Reativar ${item.title}`}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-terracota-600"
                  >
                    {item.active ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => openForm(item)}
                    aria-label={`Editar ${item.title}`}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-terracota-600"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Remover “${item.title}” do catálogo?`)) run(() => removeItem(item.id))
                    }}
                    aria-label={`Remover ${item.title}`}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="pt-6 text-xs text-ink-soft">
          Simulação: os dados ficam salvos apenas neste navegador. Peças ativas aparecem na vitrine pública; peças pausadas ficam ocultas.
        </p>
      </Container>
    </main>
  )
}

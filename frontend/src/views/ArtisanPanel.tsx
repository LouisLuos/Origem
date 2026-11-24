'use client'

import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff, Lock, Minus, Pencil, Plus, ShieldAlert, Trash2, Users } from 'lucide-react'
import { Navigate } from '@/components/Navigate'
import { Badge, Button, Container, Input, cn, currency } from '@/design-system'
import { culturalHubs, techniques } from '@/design-system/tokens'
import { useAuth } from '@/context/AuthContext'
import { ErrorBlock, LoadingBlock, ResourceGate } from '@/components/AsyncState'
import { CuratorManagementSection } from '@/components/CuratorManagementSection'
import { FinancialPixSection } from '@/components/FinancialPixSection'
import { PieceCatalogForm } from '@/components/PieceCatalogForm'
import { AtelierSetupForm } from '@/components/AtelierSetupForm'
import {
  classifyPieceError,
  pieceService,
  type CreatedPiece,
  type StudioPiece,
} from '@/services/pieceService'
import { useCatalog } from '@/context/CatalogContext'
import { useCatalogAction } from '@/hooks/useCatalogAction'
import {
  atelierGovernanceService,
  classifyGovernanceError,
  type AtelierAccessContext,
  type GovernanceErrorKind,
} from '@/services/atelierGovernanceService'
import { atelierService, type AtelierDetails } from '@/services/atelierService'
import { errorMessage } from '@/utils/errors'
import { buildPlaceholderProductImageUrl } from '@/utils/media'
import type { CatalogItem, CatalogItemInput } from '@/context/CatalogContext'

const LOW_STOCK = 3

type PanelTab = 'catalog' | 'curators' | 'financial'

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
  const atelierSelectId = useId()
  const { user } = useAuth()
  const { items, status, error: loadError, reload, addItem, updateItem, removeItem } = useCatalog()
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [publishedNotice, setPublishedNotice] = useState<string | null>(null)
  const { actionError, run } = useCatalogAction()

  const [activeTab, setActiveTab] = useState<PanelTab>('catalog')
  const [atelierLinks, setAtelierLinks] = useState<AtelierAccessContext[]>([])
  const [selectedAtelieId, setSelectedAtelieId] = useState('')
  const [governanceStatus, setGovernanceStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [governanceIssue, setGovernanceIssue] = useState<{
    kind: GovernanceErrorKind
    message: string
  } | null>(null)
  const [governanceReloadTick, setGovernanceReloadTick] = useState(0)
  const [atelierEditData, setAtelierEditData] = useState<AtelierDetails | null>(null)
  const [atelierEditLoading, setAtelierEditLoading] = useState(false)
  const [atelierEditError, setAtelierEditError] = useState<string | null>(null)

  const [studioPieces, setStudioPieces] = useState<StudioPiece[]>([])
  const [studioPiecesStatus, setStudioPiecesStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [studioPiecesError, setStudioPiecesError] = useState<string | null>(null)
  const [studioReloadTick, setStudioReloadTick] = useState(0)
  const [stockAdjustError, setStockAdjustError] = useState<string | null>(null)
  const [updatingStockPieceId, setUpdatingStockPieceId] = useState<string | null>(null)
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({})

  const userEmail = user?.email ?? null

  useEffect(() => {
    if (!userEmail) {
      return
    }

    let cancelled = false
    async function loadAtelierLinks() {
      setGovernanceStatus('loading')
      setGovernanceIssue(null)
      try {
        const links = await atelierGovernanceService.listMyAtelierLinks()
        if (cancelled) return
        setAtelierLinks(links)
        setSelectedAtelieId((current) =>
          links.some((item) => item.atelieId === current) ? current : (links[0]?.atelieId ?? ''),
        )
        setGovernanceStatus('ready')
      } catch (reason) {
        if (cancelled) return
        const classified = classifyGovernanceError(
          reason,
          'Não foi possível verificar suas permissões de ateliê.',
        )
        setAtelierLinks([])
        setSelectedAtelieId('')
        setGovernanceIssue({ kind: classified.kind, message: classified.message })
        setGovernanceStatus('unavailable')
      }
    }

    loadAtelierLinks()
    return () => {
      cancelled = true
    }
  }, [userEmail, governanceReloadTick])

  const selectedAtelierPreview =
    atelierLinks.find((item) => item.atelieId === selectedAtelieId) ?? atelierLinks[0] ?? null
  const activeCatalogAtelieId =
    selectedAtelierPreview?.permissoes.includes('GERENCIAR_CATALOGO') ? selectedAtelierPreview.atelieId : null

  useEffect(() => {
    if (!activeCatalogAtelieId) {
      setStudioPieces([])
      setStudioPiecesStatus('idle')
      setStudioPiecesError(null)
      return
    }

    const atelieId = activeCatalogAtelieId
    let cancelled = false
    async function loadStudioPieces() {
      setStudioPiecesStatus('loading')
      setStudioPiecesError(null)
      try {
        const list = await pieceService.listByAtelier(atelieId)
        if (cancelled) return
        setStudioPieces(list)
        setStockInputs((prev) => {
          const next = { ...prev }
          for (const piece of list) {
            next[piece.id] = String(piece.quantidadeEstoque)
          }
          return next
        })
        setStudioPiecesStatus('ready')
      } catch (reason) {
        if (cancelled) return
        setStudioPiecesError(classifyPieceError(reason).message)
        setStudioPiecesStatus('error')
      }
    }

    loadStudioPieces()
    return () => {
      cancelled = true
    }
  }, [activeCatalogAtelieId, studioReloadTick])

  if (!user) return <Navigate to="/entrar?from=/painel" />

  // Aguarda verificação contextual antes de redirecionar quem não tem papel legado de artesão (ex.: Curador)
  if (user.role !== 'artisan' && governanceStatus === 'loading') {
    return <ResourceGate status="loading" label="Verificando vínculos do ateliê…" />
  }

  if (user.role !== 'artisan' && atelierLinks.length === 0) {
    return <Navigate to="/conta" />
  }

  const selectedAtelier =
    atelierLinks.find((item) => item.atelieId === selectedAtelieId) ?? atelierLinks[0] ?? null

  // Permissões reais derivadas EXCLUSIVAMENTE da resposta do backend (nunca de localStorage)
  const canManageCurators = Boolean(
    selectedAtelier?.permissoes.includes('GERENCIAR_CURADORES'),
  )
  const canViewFinancial = Boolean(
    selectedAtelier?.permissoes.includes('CONSULTAR_DADOS_FINANCEIROS'),
  )
  const canUpdatePix = Boolean(
    selectedAtelier?.permissoes.includes('ALTERAR_CHAVE_PIX'),
  )
  const canEditAtelier = Boolean(
    selectedAtelier?.permissoes.includes('EDITAR_DADOS_ATELIE'),
  )
  const canAccessFinancialTab = canViewFinancial || canUpdatePix
  const isSuspendedForCurator = Boolean(
    selectedAtelier &&
    selectedAtelier.papelNoAtelie === 'CURADOR' &&
    selectedAtelier.statusAtelie === 'SUSPENSO',
  )

  const resolvedTab: PanelTab =
    activeTab === 'curators' && canManageCurators
      ? 'curators'
      : activeTab === 'financial' && canAccessFinancialTab
        ? 'financial'
        : 'catalog'

  const handleSelectAtelier = (nextAtelieId: string) => {
    setSelectedAtelieId(nextAtelieId)
    setAtelierEditData(null)
    setAtelierEditError(null)
    const nextCtx = atelierLinks.find((item) => item.atelieId === nextAtelieId)
    if (
      (activeTab === 'curators' && !nextCtx?.permissoes.includes('GERENCIAR_CURADORES')) ||
      (activeTab === 'financial' &&
        !nextCtx?.permissoes.includes('CONSULTAR_DADOS_FINANCEIROS') &&
        !nextCtx?.permissoes.includes('ALTERAR_CHAVE_PIX'))
    ) {
      setActiveTab('catalog')
    }
  }

  const handleEditAtelier = async () => {
    if (!selectedAtelier) return
    setAtelierEditLoading(true)
    setAtelierEditError(null)
    setAtelierEditData(null)
    try {
      setAtelierEditData(await atelierService.get(selectedAtelier.atelieId))
    } catch (reason) {
      setAtelierEditError(reason instanceof Error ? reason.message : 'Não foi possível carregar o ateliê.')
    } finally {
      setAtelierEditLoading(false)
    }
  }

  const myItems = items.filter((item) => item.ownerEmail === user.email)
  const activeCount = activeCatalogAtelieId
    ? studioPieces.filter((piece) => piece.status !== 'ARQUIVADA').length
    : myItems.filter((item) => item.active).length
  const totalUnits = activeCatalogAtelieId
    ? studioPieces.reduce((total, piece) => total + piece.quantidadeEstoque, 0)
    : myItems.reduce((total, item) => total + item.stock, 0)
  const lowStock = activeCatalogAtelieId
    ? studioPieces.filter((piece) => piece.quantidadeEstoque > 0 && piece.quantidadeEstoque <= LOW_STOCK).length
    : myItems.filter((item) => item.stock > 0 && item.stock <= LOW_STOCK).length
  const soldOut = activeCatalogAtelieId
    ? studioPieces.filter((piece) => piece.quantidadeEstoque === 0).length
    : myItems.filter((item) => item.stock === 0).length

  // : a publicação exige ateliê confirmado pelo servidor com permissão de catálogo.
  const catalogAtelieId = activeCatalogAtelieId
  const catalogUnavailableReason =
    governanceStatus === 'loading'
      ? 'Consultando no servidor os ateliês em que você pode catalogar peças.'
      : governanceStatus === 'unavailable'
        ? (governanceIssue?.message ?? 'Não foi possível confirmar seu vínculo de ateliê no servidor.')
        : !selectedAtelier
          ? 'Nenhum ateliê vinculado à sua conta foi encontrado no servidor.'
          : 'Seu vínculo com este ateliê não permite gerenciar o catálogo.'

  const handlePiecePublished = (piece: CreatedPiece) => {
    setEditingId(null)
    setStudioReloadTick((tick) => tick + 1)
    // A vitrine passa a incluir a peça publicada (GET /produtos lê o banco)
    reload()
    setPublishedNotice(
      `Peça “${piece.titulo}” publicada com estoque de ${piece.quantidadeEstoque} unidade(s), status ${piece.status} e ${piece.fotos.length} fotos.`,
    )
  }

  const handleAdjustRealStock = async (
    pieceId: string,
    payload: { quantidadeEstoque: number } | { delta: number },
  ) => {
    if (!catalogAtelieId) return
    setStockAdjustError(null)
    setUpdatingStockPieceId(pieceId)
    try {
      const updated = await pieceService.updateStock(catalogAtelieId, pieceId, payload)
      setStudioPieces((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setStockInputs((prev) => ({ ...prev, [updated.id]: String(updated.quantidadeEstoque) }))
      reload()
    } catch (reason) {
      setStockAdjustError(classifyPieceError(reason).message)
    } finally {
      setUpdatingStockPieceId(null)
    }
  }

  const openForm = (item?: CatalogItem) => {
    setError(null)
    setPublishedNotice(null)
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
        form.imageUrl.trim() || buildPlaceholderProductImageUrl(form.title.trim()),
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
      setError(errorMessage(reason, 'Não foi possível salvar a peça.'))
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
        <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
          <div>
            <p className="text-sm text-ink-soft">Painel do ateliê</p>
            <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
              {resolvedTab === 'catalog'
                ? 'Meu catálogo'
                : resolvedTab === 'curators'
                  ? 'Gestão de curadores'
                  : 'Dados financeiros e Chave Pix'}
            </h1>
          </div>
          {resolvedTab === 'catalog' && status === 'ready' && (
            <Button variant="primary" size="md" onClick={() => openForm()}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nova peça
            </Button>
          )}
        </div>

        {/* Barra de governança contextual: exibe apenas vínculos confirmados pelo backend */}
        <section
          aria-label="Contexto de acesso ao ateliê"
          className="mb-8 border border-border bg-surface p-5"
        >
          {governanceStatus === 'loading' && (
            <p role="status" className="text-sm text-ink-soft">
              Consultando permissões contextuais no servidor…
            </p>
          )}

          {governanceStatus === 'unavailable' && governanceIssue && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-4 text-sm">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-ink">
                    {governanceIssue.kind === 'unauthenticated' ||
                      governanceIssue.kind === 'auth_unavailable'
                      ? 'Governança financeira e de curadores aguardando autenticação real'
                      : governanceIssue.kind === 'persistence_unavailable'
                        ? 'Governança financeira e de curadores aguardando banco de dados'
                        : 'Não foi possível confirmar o vínculo contextual no servidor'}
                  </p>
                  <p className="pt-1 text-ink-soft">
                    {governanceIssue.message} O controle legado de catálogo continua disponível
                    abaixo. Seções financeiras e de curadores permanecem ocultas por segurança.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGovernanceReloadTick((tick) => tick + 1)}
              >
                Verificar novamente
              </Button>
            </div>
          )}

          {governanceStatus === 'ready' && atelierLinks.length === 0 && user.role === 'artisan' && (
            // : artesão titular habilitado ainda sem ateliê cadastra o seu aqui
            <AtelierSetupForm onSaved={() => setGovernanceReloadTick((tick) => tick + 1)} />
          )}

          {governanceStatus === 'ready' && atelierLinks.length === 0 && user.role !== 'artisan' && (
            <p role="status" className="text-sm text-ink-soft">
              Nenhum ateliê vinculado foi encontrado para sua conta autenticada. As seções de
              curadores e Chave Pix permanecem ocultas até que o vínculo seja confirmado pelo servidor.
            </p>
          )}

          {governanceStatus === 'ready' && selectedAtelier && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">
                    {selectedAtelier.nomeComercial ?? `Ateliê ${selectedAtelier.atelieId}`}
                  </span>
                  <Badge
                    tone={selectedAtelier.papelNoAtelie === 'TITULAR' ? 'terracota' : 'aubergine'}
                  >
                    {selectedAtelier.papelNoAtelie === 'TITULAR'
                      ? 'Titular do ateliê'
                      : 'Curador vinculado'}
                  </Badge>
                  <Badge tone={selectedAtelier.statusAtelie === 'ATIVO' ? 'oliva' : 'neutral'}>
                    {selectedAtelier.statusAtelie === 'ATIVO' ? 'Ativo' : 'Suspenso'}
                  </Badge>
                  {canEditAtelier && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleEditAtelier}
                      disabled={atelierEditLoading}
                    >
                      <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                      {atelierEditLoading ? 'Carregando…' : 'Editar ateliê'}
                    </Button>
                  )}
                </div>

                {atelierLinks.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label htmlFor={atelierSelectId} className="text-xs font-medium text-ink-soft">
                      Ateliê ativo:
                    </label>
                    <select
                      id={atelierSelectId}
                      value={selectedAtelier.atelieId}
                      onChange={(event) => handleSelectAtelier(event.target.value)}
                      className="border border-border bg-surface px-3 py-1.5 text-sm text-ink focus:border-terracota"
                    >
                      {atelierLinks.map((ctx) => (
                        <option key={ctx.atelieId} value={ctx.atelieId}>
                          {(ctx.nomeComercial ?? ctx.atelieId)} (
                          {ctx.papelNoAtelie === 'TITULAR' ? 'Titular' : 'Curador'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {atelierEditError && (
                <p role="alert" className="text-sm text-danger">
                  {atelierEditError}
                </p>
              )}

              {atelierEditData?.id === selectedAtelier.atelieId ? (
                <AtelierSetupForm
                  key={atelierEditData.id}
                  initialData={atelierEditData}
                  onSaved={() => {
                    setAtelierEditData(null)
                    setGovernanceReloadTick((tick) => tick + 1)
                  }}
                  onCancel={() => setAtelierEditData(null)}
                />
              ) : (
                <>
                  {selectedAtelier.papelNoAtelie === 'CURADOR' && (
                    <p className="text-xs text-ink-soft">
                      {isSuspendedForCurator
                        ? 'Este ateliê está suspenso: o acesso operacional de curadores foi bloqueado pelo servidor.'
                        : 'Você atua como curador operacional neste ateliê (permissões restritas a catálogo e etiquetas). Informações financeiras e Chave Pix permanecem inacessíveis.'}
                    </p>
                  )}

                  <div role="tablist" aria-label="Seções do ateliê" className="flex flex-wrap gap-2 border-t border-border pt-4">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={resolvedTab === 'catalog'}
                      onClick={() => setActiveTab('catalog')}
                      className={cn(
                        'cursor-pointer border px-4 py-2 text-sm font-medium transition-colors',
                        resolvedTab === 'catalog'
                          ? 'border-terracota bg-terracota text-creme-50'
                          : 'border-border text-ink-soft hover:text-ink',
                      )}
                    >
                      Catálogo
                    </button>

                    {canManageCurators && (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={resolvedTab === 'curators'}
                        onClick={() => setActiveTab('curators')}
                        className={cn(
                          'inline-flex cursor-pointer items-center gap-2 border px-4 py-2 text-sm font-medium transition-colors',
                          resolvedTab === 'curators'
                            ? 'border-terracota bg-terracota text-creme-50'
                            : 'border-border text-ink-soft hover:text-ink',
                        )}
                      >
                        <Users className="h-4 w-4" aria-hidden="true" />
                        Curadores
                      </button>
                    )}

                    {canAccessFinancialTab && (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={resolvedTab === 'financial'}
                        onClick={() => setActiveTab('financial')}
                        className={cn(
                          'inline-flex cursor-pointer items-center gap-2 border px-4 py-2 text-sm font-medium transition-colors',
                          resolvedTab === 'financial'
                            ? 'border-terracota bg-terracota text-creme-50'
                            : 'border-border text-ink-soft hover:text-ink',
                        )}
                      >
                        <Lock className="h-4 w-4" aria-hidden="true" />
                        Dados financeiros
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        {!atelierEditData && resolvedTab === 'curators' && selectedAtelier && canManageCurators && (
          <CuratorManagementSection
            key={selectedAtelier.atelieId}
            atelieId={selectedAtelier.atelieId}
            canManageCurators={canManageCurators}
          />
        )}

        {!atelierEditData && resolvedTab === 'financial' && selectedAtelier && canAccessFinancialTab && (
          <FinancialPixSection
            key={selectedAtelier.atelieId}
            atelieId={selectedAtelier.atelieId}
            canViewFinancial={canViewFinancial}
            canUpdatePix={canUpdatePix}
          />
        )}

        {resolvedTab === 'catalog' && (
          <>
            {status === 'loading' ? (
              <LoadingBlock label="Carregando catálogo…" />
            ) : status === 'error' ? (
              <ErrorBlock message={loadError} onRetry={reload} />
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-4 pb-10 lg:grid-cols-4">
                  {summary.map(({ label, value }) => (
                    <div key={label} className="border border-border bg-aubergine-400/10 p-4">
                      <dt className="text-xs uppercase tracking-widest text-ink-soft">{label}</dt>
                      <dd className="pt-1 text-2xl font-semibold text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>

                {publishedNotice && (
                  <p role="status" className="mb-6 border border-border bg-surface p-4 text-sm text-ink">
                    {publishedNotice}
                  </p>
                )}

                {editingId === 'new' && (
                  <PieceCatalogForm
                    atelieId={catalogAtelieId}
                    unavailableReason={catalogUnavailableReason}
                    onCancel={closeForm}
                    onPublished={handlePiecePublished}
                  />
                )}

                {editingId && editingId !== 'new' && (
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

                {catalogAtelieId && (
                  <section aria-label="Acervo persistido do ateliê" className="mb-10 flex flex-col gap-4 border border-border bg-surface p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold uppercase tracking-widest text-ink">
                        Peças publicadas no servidor (PostgreSQL)
                      </h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setStudioReloadTick((tick) => tick + 1)}
                      >
                        Atualizar estoque
                      </Button>
                    </div>

                    {stockAdjustError && (
                      <p role="alert" className="border border-danger/30 bg-surface-muted px-4 py-2.5 text-sm text-danger">
                        {stockAdjustError}
                      </p>
                    )}

                    {studioPiecesStatus === 'loading' && (
                      <LoadingBlock label="Carregando acervo persistido do ateliê…" />
                    )}

                    {studioPiecesStatus === 'error' && studioPiecesError && (
                      <ErrorBlock
                        message={studioPiecesError}
                        onRetry={() => setStudioReloadTick((tick) => tick + 1)}
                      />
                    )}

                    {studioPiecesStatus === 'ready' && studioPieces.length === 0 && (
                      <div className="flex flex-col items-center gap-3 border border-dashed border-border py-10 text-center">
                        <p className="text-base font-medium text-ink">Nenhuma peça cadastrada neste ateliê</p>
                        <p className="text-sm text-ink-soft">
                          Publique uma peça informando preço, cubagem, fotos e quantidade em estoque.
                        </p>
                        <Button variant="primary" size="md" onClick={() => openForm()}>
                          Nova peça
                        </Button>
                      </div>
                    )}

                    {studioPiecesStatus === 'ready' && studioPieces.length > 0 && (
                      <ul className="flex flex-col divide-y divide-border">
                        {studioPieces.map((piece) => {
                          const coverUrl =
                            piece.fotos.find((foto) => foto.isPrincipal)?.url ?? piece.fotos[0]?.url ?? ''
                          const isBusy = updatingStockPieceId === piece.id
                          const rawInput = stockInputs[piece.id] ?? String(piece.quantidadeEstoque)
                          const isSoldOutPiece = piece.quantidadeEstoque === 0
                          const isLowStockPiece =
                            piece.quantidadeEstoque > 0 && piece.quantidadeEstoque <= LOW_STOCK

                          return (
                            <li
                              key={piece.id}
                              className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                            >
                              <div className="flex min-w-56 flex-1 items-center gap-4">
                                {coverUrl ? (
                                  <img src={coverUrl} alt={piece.titulo} className="h-16 w-16 shrink-0 object-cover" />
                                ) : (
                                  <div className="h-16 w-16 shrink-0 bg-surface-muted" aria-hidden="true" />
                                )}
                                <div className="flex flex-col gap-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-ink">{piece.titulo}</span>
                                    <Badge tone={piece.status === 'DISPONIVEL' ? 'oliva' : 'neutral'}>
                                      {piece.status}
                                    </Badge>
                                  </div>
                                  <span className="text-xs text-ink-soft">
                                    {piece.tipologia ?? 'Artesanato'} ·{' '}
                                    {piece.preco !== undefined ? currency.format(piece.preco) : ''}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-3">
                                <div className="flex flex-col items-start gap-1">
                                  <div className="flex h-9 items-center border border-border">
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustRealStock(piece.id, { delta: -1 })}
                                      disabled={isBusy || isSoldOutPiece}
                                      aria-label={`Diminuir estoque de ${piece.titulo}`}
                                      className="flex h-full w-8 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-terracota-600 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                    <span
                                      aria-live="polite"
                                      className={cn('w-10 text-center text-sm font-semibold', stockTone(piece.quantidadeEstoque))}
                                    >
                                      {piece.quantidadeEstoque}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustRealStock(piece.id, { delta: 1 })}
                                      disabled={isBusy}
                                      aria-label={`Aumentar estoque de ${piece.titulo}`}
                                      className="flex h-full w-8 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-terracota-600 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                  </div>
                                  <span className={cn('text-[11px] uppercase tracking-widest', stockTone(piece.quantidadeEstoque))}>
                                    {isSoldOutPiece
                                      ? 'Esgotado'
                                      : isLowStockPiece
                                        ? 'Restam poucas unidades · Estoque baixo'
                                        : 'Em estoque'}
                                  </span>
                                </div>

                                <form
                                  className="flex items-center gap-2"
                                  onSubmit={(event) => {
                                    event.preventDefault()
                                    const parsed = Number(rawInput.trim())
                                    if (!Number.isInteger(parsed) || parsed < 0) {
                                      setStockAdjustError(
                                        'Informe um número inteiro maior ou igual a 0 para definir o saldo.',
                                      )
                                      return
                                    }
                                    void handleAdjustRealStock(piece.id, { quantidadeEstoque: parsed })
                                  }}
                                >
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    aria-label={`Definir estoque de ${piece.titulo}`}
                                    value={rawInput}
                                    onChange={(event) =>
                                      setStockInputs((prev) => ({ ...prev, [piece.id]: event.target.value }))
                                    }
                                    className="h-9 w-20 border border-border bg-surface px-2 text-center text-sm text-ink focus:border-terracota"
                                  />
                                  <Button type="submit" variant="outline" size="sm" disabled={isBusy}>
                                    Aplicar
                                  </Button>
                                </form>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </section>
                )}

                {actionError && (
                  <p role="alert" className="pb-4 text-sm text-danger">
                    {actionError}
                  </p>
                )}

                  {!catalogAtelieId && myItems.length === 0 ? (
                <div className="flex flex-col items-center gap-4 border border-dashed border-border py-14 text-center">
                  <p className="text-base font-medium text-ink">Seu catálogo está vazio</p>
                  <p className="text-sm text-ink-soft">Cadastre sua primeira peça para começar a controlar o estoque.</p>
                  <Button variant="primary" size="md" onClick={() => openForm()}>
                    Nova peça
                  </Button>
                </div>
                ) : myItems.length > 0 ? (
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
                        <span className={cn('text-sm font-semibold', stockTone(item.stock))}>
                          {item.stock} unidade(s)
                        </span>
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
                ) : null}

                {!catalogAtelieId && (
                  <p className="pt-6 text-xs text-ink-soft">
                    Os dados reais do acervo exigem sessão autenticada com ateliê vinculado no servidor.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </Container>
    </main>
  )
}

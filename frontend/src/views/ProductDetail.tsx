'use client'

import type { CatalogItem } from '@/services/catalogTypes'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChevronRight, Cpu, MapPin, ShieldCheck, Sparkles } from 'lucide-react'
import { Badge, ButtonLink, Container, ProductCard, cn, currency } from '@/design-system'
import { ErrorBlock, LoadingBlock, ResourceGate } from '@/components/AsyncState'
import { useArtisans } from '@/context/ArtisanContext'
import { useCatalog } from '@/context/CatalogContext'
import { useProductFilter } from '@/context/ProductFilterContext'
import { findArtisanOf } from '@/utils/artisanMatch'
import {
  recommendationService,
  type RecommendationMode,
  type RecommendationResult,
} from '@/services/recommendationService'
import { errorMessage } from '@/utils/errors'

const LOW_STOCK_THRESHOLD = 3
const WORKER_OPTIONS = [2, 4, 8] as const

const motivoLabels: Record<string, string> = {
  mesma_tecnica: 'Mesma técnica',
  mesmo_polo: 'Mesmo polo',
  comprados_juntos: 'Comprados juntos',
}

function DetailSection({ title, children, defaultOpen }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group border-b border-border py-4" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold uppercase tracking-widest text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden="true" className="text-lg leading-none text-ink-soft group-open:hidden">
          +
        </span>
        <span aria-hidden="true" className="hidden text-lg leading-none text-ink-soft group-open:inline">
          −
        </span>
      </summary>
      <div className="pt-3 text-sm leading-relaxed text-ink-soft">{children}</div>
    </details>
  )
}

const trustPoints = [
  { icon: Sparkles, label: 'Produção autoral', description: 'Peça feita à mão por mestre artesão.' },
  { icon: MapPin, label: 'Origem certificada', description: 'Identidade cultural de Pernambuco.' },
  { icon: ShieldCheck, label: 'Curadoria Origem', description: 'Procedência e técnica preservadas.' },
]

export function ProductDetail({ initialProduct }: { initialProduct?: CatalogItem }) {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { selectTechnique } = useProductFilter()

  const { getProduct, status, error, reload } = useCatalog()
  const { artisans } = useArtisans()

  const product = initialProduct ?? getProduct(id)

  const [activeImage, setActiveImage] = useState(0)
  const [recMode, setRecMode] = useState<RecommendationMode>('parallel')
  const [recWorkers, setRecWorkers] = useState<number>(4)
  const [recStatus, setRecStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [recResult, setRecResult] = useState<RecommendationResult | null>(null)
  const [recError, setRecError] = useState<string | null>(null)
  const [recReloadTick, setRecReloadTick] = useState(0)

  const productId = product?.id ?? null

  useEffect(() => {
    if (!productId) return
    const controller = new AbortController()
    setRecStatus('loading')
    setRecError(null)

    recommendationService
      .getForProduct(productId, {
        limit: 4,
        mode: recMode,
        workers: recMode === 'parallel' ? recWorkers : 1,
        signal: controller.signal,
      })
      .then((data) => {
        if (controller.signal.aborted) return
        setRecResult(data)
        setRecStatus('ready')
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setRecResult(null)
        setRecError(
          errorMessage(reason, 'Não foi possível consultar o serviço de recomendações.'),
        )
        setRecStatus('error')
      })

    return () => {
      controller.abort()
    }
  }, [productId, recMode, recWorkers, recReloadTick])

  if (status !== 'ready' && !product) {
    return <ResourceGate status={status} label="Carregando peça…" error={error} onRetry={reload} spacing="detail" />
  }

  if (!product) {
    return (
      <main id="main-content" className="pt-32 pb-24">
        <Container className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-2xl font-semibold text-ink">Peça não encontrada</h1>
          <p className="max-w-md text-ink-soft">
            O produto que você procura não existe ou não está mais disponível na vitrine.
          </p>
          <ButtonLink href="/#vitrine" variant="primary">
            Voltar à vitrine
          </ButtonLink>
        </Container>
      </main>
    )
  }

  const hasDiscount = !!product.compareAtPrice && product.compareAtPrice > product.price
  const discountPercent = hasDiscount
    ? Math.round(100 - (product.price / (product.compareAtPrice as number)) * 100)
    : 0
  const gallery =
    product.gallery && product.gallery.length > 0 ? product.gallery : [product.imageUrl]
  const stockCount = typeof product.stock === 'number' ? Math.max(0, Math.floor(product.stock)) : undefined
  const isSoldOut = stockCount === 0
  const isLowStock = stockCount !== undefined && stockCount > 0 && stockCount <= LOW_STOCK_THRESHOLD
  const artisan = findArtisanOf(product, artisans)

  const goToTechnique = () => {
    selectTechnique(product.technique)
    router.push('/#vitrine')
  }

  return (
    <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
      <Container>
        <nav aria-label="Trilha de navegação" className="flex flex-wrap items-center gap-1.5 pb-8 text-xs text-ink-soft">
          <Link href="/#vitrine" className="hover:text-terracota-600 hover:underline underline-offset-4">
            Vitrine
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <button
            type="button"
            onClick={goToTechnique}
            className="cursor-pointer hover:text-terracota-600 hover:underline underline-offset-4"
          >
            {product.technique}
          </button>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span aria-current="page" className="truncate text-ink">
            {product.title}
          </span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="relative aspect-square overflow-hidden bg-surface-muted">
              <img
                src={gallery[activeImage]}
                alt={product.imageAlt}
                className="h-full w-full object-cover"
              />
              {hasDiscount && (
                <Badge tone="terracota" className="absolute left-3 top-3 border-none bg-terracota-400/90 text-[11px] font-medium tracking-wide text-white">
                  {discountPercent}% off
                </Badge>
              )}
            </div>

            {gallery.length > 1 && (
              <div className="flex gap-3">
                {gallery.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-label={`Ver imagem ${index + 1} de ${product.title}`}
                    aria-current={activeImage === index}
                    className={`h-20 w-20 shrink-0 cursor-pointer overflow-hidden bg-surface-muted transition-opacity ${activeImage === index ? 'opacity-100 ring-2 ring-terracota' : 'opacity-60 hover:opacity-100'
                      }`}
                  >
                    <img src={image} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-ink-soft/70">
                {product.technique} · {product.hub}
              </span>
              <h1 className="text-2xl font-semibold leading-snug text-ink sm:text-3xl">{product.title}</h1>
              <p className="text-sm text-ink-soft">
                por{' '}
                {artisan ? (
                  <Link
                    href={`/artesaos/${artisan.id}`}
                    className="font-medium text-ink underline-offset-4 hover:text-terracota-600 hover:underline"
                  >
                    {product.artisan}
                  </Link>
                ) : (
                  <Link
                    href="/#artesaos"
                    className="font-medium text-ink underline-offset-4 hover:text-terracota-600 hover:underline"
                  >
                    {product.artisan}
                  </Link>
                )}
              </p>
            </div>

            <div className="flex items-baseline gap-3">
              {hasDiscount && (
                <span className="text-base text-ink-soft line-through opacity-70">
                  {currency.format(product.compareAtPrice as number)}
                </span>
              )}
              <span className="text-2xl font-semibold text-terracota-600">{currency.format(product.price)}</span>
            </div>

            {product.description && <p className="text-sm leading-relaxed text-ink-soft">{product.description}</p>}

            {isSoldOut ? (
              <div role="status" className="border border-danger/30 bg-surface-muted px-4 py-2.5 text-sm font-semibold text-danger">
                Esgotado — sem unidades disponíveis no acervo no momento.
              </div>
            ) : isLowStock && stockCount !== undefined ? (
              <div role="status" className="border border-warning/40 bg-surface-muted px-4 py-2.5 text-sm font-medium text-warning">
                Restam poucas unidades: apenas {stockCount} {stockCount === 1 ? 'unidade disponível' : 'unidades disponíveis'}.
              </div>
            ) : stockCount !== undefined ? (
              <p className="text-sm text-ink-soft">
                Estoque disponível: <strong className="text-ink">{stockCount}</strong> unidades
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-3 border-y border-border py-5 sm:grid-cols-3">
              {trustPoints.map(({ icon: Icon, label, description }) => (
                <div key={label} className="flex items-start gap-2.5">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-terracota-500" aria-hidden="true" />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-ink">{label}</span>
                    <span className="text-xs text-ink-soft">{description}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col">
              {product.details && product.details.length > 0 && (
                <DetailSection title="Detalhes da peça" defaultOpen>
                  <ul className="flex flex-col gap-1.5">
                    {product.details.map((detail) => (
                      <li key={detail} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 bg-terracota-400" aria-hidden="true" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </DetailSection>
              )}

                <DetailSection title="Sobre o artesão" defaultOpen>
                  {artisan ? (
                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={artisan.photoUrl}
                          alt={artisan.photoAlt}
                          className="h-14 w-14 shrink-0 object-cover"
                        />
                        <p>{artisan.bio}</p>
                      </div>
                      <Link
                        href={`/artesaos/${artisan.id}`}
                        className="w-fit font-medium text-terracota-600 underline-offset-4 hover:underline"
                      >
                        Ver perfil completo
                      </Link>
                    </div>
                  ) : (
                    <p>
                      {product.artisan} é responsável pela técnica de {product.technique.toLowerCase()} em{' '}
                      {product.hub}, mantendo viva uma tradição do artesanato pernambucano.
                    </p>
                  )}
                </DetailSection>

                <DetailSection title="Envio e cuidados">
                  <p>
                    Peça produzida sob demanda ou em pequenos lotes: o prazo de envio pode variar conforme a
                    disponibilidade do artesão. Por ser feita à mão, pequenas variações de cor, forma e textura fazem
                    parte da identidade de cada peça.
                  </p>
                </DetailSection>
            </div>
          </div>
        </div>

            <section
              aria-labelledby="recommendations-heading"
              className="mt-16 flex flex-col gap-6 border-t border-border pt-16 sm:mt-20 sm:pt-20"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-col gap-1">
                  <h2 id="recommendations-heading" className="text-xl font-semibold text-ink sm:text-2xl">
                    Você também pode gostar
                  </h2>
                  <p className="text-xs text-ink-soft">
                    Recomendações calculadas via serviço distribuído (Catalog Service → Recommendation Service · HU-24).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div role="group" aria-label="Modo de processamento das recomendações" className="inline-flex border border-border bg-surface p-0.5">
                    <button
                      type="button"
                      onClick={() => setRecMode('sequential')}
                      aria-pressed={recMode === 'sequential'}
                      className={cn(
                        'cursor-pointer px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
                        recMode === 'sequential'
                          ? 'bg-aubergine text-creme-50'
                          : 'text-ink-soft hover:text-ink',
                      )}
                    >
                      Sequencial
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecMode('parallel')}
                      aria-pressed={recMode === 'parallel'}
                      className={cn(
                        'cursor-pointer px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
                        recMode === 'parallel'
                          ? 'bg-aubergine text-creme-50'
                          : 'text-ink-soft hover:text-ink',
                      )}
                    >
                      Paralelo
                    </button>
                  </div>

                  {recMode === 'parallel' && (
                    <label className="flex items-center gap-2 border border-border bg-surface px-2.5 py-1.5 text-xs text-ink-soft">
                      <span className="font-semibold uppercase tracking-wider">Workers</span>
                      <select
                        aria-label="Quantidade de workers paralelos"
                        value={recWorkers}
                        onChange={(event) => setRecWorkers(Number(event.target.value))}
                        className="cursor-pointer bg-transparent font-semibold text-ink focus:outline-none"
                      >
                        {WORKER_OPTIONS.map((count) => (
                          <option key={count} value={count}>
                            {count}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </div>

              {recStatus === 'ready' && recResult && (
                <div className="grid grid-cols-2 gap-3 border border-border/80 bg-surface-muted/70 px-4 py-3 text-xs md:grid-cols-3 xl:grid-cols-5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">Modo</span>
                    <span className="flex items-center gap-1 font-semibold text-ink">
                      <Cpu className="h-3.5 w-3.5 text-terracota-500" aria-hidden="true" />
                      {recResult.metrics.mode === 'parallel' ? 'Paralelo (ProcessPoolExecutor)' : 'Sequencial'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">Algoritmo</span>
                    <span className="font-semibold text-ink">{recResult.metrics.computeMs.toFixed(2)} ms</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">HTTP entre serviços</span>
                    <span className="font-semibold text-ink">{recResult.metrics.gatewayHttpMs.toFixed(2)} ms</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">Workers</span>
                    <span className="font-semibold text-ink">{recResult.metrics.workers}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">Catálogo processado</span>
                    <span className="font-semibold text-ink">
                      {recResult.metrics.catalogSize} peças ({recResult.metrics.dataSource.includes('postgresql') ? 'PostgreSQL + acervo local' : 'Acervo local'})
                    </span>
                  </div>
                </div>
              )}

              {recStatus === 'loading' && <LoadingBlock label="Calculando recomendações distribuídas…" />}

              {recStatus === 'error' && (
                <ErrorBlock
                  message={recError ?? 'Falha ao consultar recomendações no serviço distribuído.'}
                  onRetry={() => setRecReloadTick((tick) => tick + 1)}
                />
              )}

              {recStatus === 'ready' && recResult && recResult.items.length === 0 && (
                <p className="py-8 text-center text-sm text-ink-soft">
                  Nenhuma peça afim em estoque encontrada para esta combinação de técnica e polo.
                </p>
              )}

              {recStatus === 'ready' && recResult && recResult.items.length > 0 && (
                <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {
                      recResult.items.map((related) => (
                        <div key={related.id} className="flex flex-col gap-2">
                          <ProductCard product={related} />
                          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-ink-soft">
                            <span className="font-semibold text-terracota-600">Score {related.score.toFixed(2)}</span>
                            {related.motivos.map((motivo) => (
                              <span
                                key={motivo}
                                className="border border-border bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
                              >
                                {motivoLabels[motivo] ?? motivo}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    }
            </div>
          )}
      </section>
    </Container>
    </main >
  )
}

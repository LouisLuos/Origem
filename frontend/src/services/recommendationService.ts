import { apiRequest } from './api'
import type { CatalogItem } from './catalogTypes'

export type RecommendationMode = 'sequential' | 'parallel'

export interface RecommendedProduct extends CatalogItem {
  rank: number
  score: number
  similaridade: number
  coocorrencia: number
  motivos: string[]
}

export interface RecommendationMetrics {
  mode: RecommendationMode
  workers: number
  computeMs: number
  catalogFetchMs: number
  gatewayHttpMs: number
  totalMs: number
  catalogSize: number
  dataSource: string
  isSynthetic: boolean
}

export interface RecommendationResult {
  produtoNaPagina: {
    productId: string
    title: string
    technique: string
    hub: string
  }
  items: RecommendedProduct[]
  estrategia: string
  metrics: RecommendationMetrics
}

export interface GetRecommendationsOptions {
  limit?: number
  mode?: RecommendationMode
  workers?: number
  signal?: AbortSignal
}

/**
 * Consome o endpoint distribuído de recomendações do Catalog Service (:3001),
 * que por sua vez consulta o Recommendation Service (:3002) via HTTP/REST.
 */
export const recommendationService = {
  async getForProduct(
    productId: string,
    options: GetRecommendationsOptions = {},
  ): Promise<RecommendationResult> {
    const params = new URLSearchParams()
    params.set('limit', String(options.limit ?? 4))
    params.set('mode', options.mode ?? 'parallel')
    if (options.mode === 'parallel' && options.workers !== undefined) {
      params.set('workers', String(options.workers))
    }

    return apiRequest<RecommendationResult>(
      `/produtos/${encodeURIComponent(productId)}/recomendacoes?${params.toString()}`,
      { signal: options.signal },
      'Não foi possível carregar as recomendações distribuídas para esta peça.',
    )
  },
}

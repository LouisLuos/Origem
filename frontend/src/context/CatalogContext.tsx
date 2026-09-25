import { createContext, useCallback, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useResource } from '@/hooks/useResource'
import type { ResourceStatus } from '@/hooks/useResource'
import { catalogService } from '@/services/catalogService'
import type { CatalogItem, CatalogItemInput, Owner } from '@/services/catalogService'

export type { CatalogItem, CatalogItemInput }

export interface CatalogContextValue {
  /** Todas as peças (inclusive pausadas) — para os painéis do artesão e da administração. */
  items: CatalogItem[]
  /** Somente peças ativas — o que a vitrine pública exibe. */
  products: CatalogItem[]
  status: ResourceStatus
  error: string | null
  reload: () => void
  getProduct: (id: string) => CatalogItem | undefined
  addItem: (owner: Owner, input: CatalogItemInput) => Promise<void>
  updateItem: (id: string, patch: Partial<CatalogItemInput>) => Promise<void>
  adjustStock: (id: string, delta: number) => Promise<void>
  removeItem: (id: string) => Promise<void>
  /** Atualiza o estado local com o catálogo devolvido por outra operação (ex.: baixa de estoque num pedido). */
  replaceAll: (items: CatalogItem[]) => void
}

const CatalogContext = createContext<CatalogContextValue | null>(null)

/** Estado do catálogo no front-end, alimentado por `catalogService`. Fonte única da vitrine e dos painéis. */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const { data: items, setData, status, error, reload } = useResource(catalogService.list, [] as CatalogItem[])

  const replaceItem = useCallback(
    (updated: CatalogItem) => setData((prev) => prev.map((item) => (item.id === updated.id ? updated : item))),
    [setData],
  )

  const value = useMemo<CatalogContextValue>(() => {
    const products = items.filter((item) => item.active)
    return {
      items,
      products,
      status,
      error,
      reload,
      getProduct: (id) => products.find((item) => item.id === id),
      addItem: async (owner, input) => {
        const created = await catalogService.create(owner, input)
        setData((prev) => [created, ...prev])
      },
      updateItem: async (id, patch) => replaceItem(await catalogService.update(id, patch)),
      adjustStock: async (id, delta) => replaceItem(await catalogService.adjustStock(id, delta)),
      removeItem: async (id) => {
        await catalogService.remove(id)
        setData((prev) => prev.filter((item) => item.id !== id))
      },
      replaceAll: (next) => setData(next),
    }
  }, [items, status, error, reload, setData, replaceItem])

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const context = useContext(CatalogContext)
  if (!context) {
    throw new Error('useCatalog deve ser usado dentro de um CatalogProvider')
  }
  return context
}

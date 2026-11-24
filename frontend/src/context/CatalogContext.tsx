'use client'

import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useResource } from '@/hooks/useResource'
import type { ResourceStatus } from '@/hooks/useResource'
import { catalogService } from '@/services/catalogService'
import type { CatalogItem } from '@/services/catalogTypes'

export type { CatalogItem }

export interface CatalogContextValue {
  /** Todas as peças carregadas do Catalog Service. */
  items: CatalogItem[]
  /** Somente peças ativas — o que a vitrine pública exibe. */
  products: CatalogItem[]
  status: ResourceStatus
  error: string | null
  reload: () => void
  getProduct: (id: string) => CatalogItem | undefined
}

const CatalogContext = createContext<CatalogContextValue | null>(null)

/** Estado público do catálogo no front-end, alimentado por `catalogService`. */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const { data: items, status, error, reload } = useResource(catalogService.list, [] as CatalogItem[])

  const value = useMemo<CatalogContextValue>(() => {
    const products = items.filter((item) => item.active)
    return {
      items,
      products,
      status,
      error,
      reload,
      getProduct: (id) => products.find((item) => item.id === id),
    }
}, [items, status, error, reload])

return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const context = useContext(CatalogContext)
  if (!context) {
    throw new Error('useCatalog deve ser usado dentro de um CatalogProvider')
  }
  return context
}

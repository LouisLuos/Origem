import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useResource } from '@/hooks/useResource'
import type { ResourceStatus } from '@/hooks/useResource'
import { artisanService } from '@/services/artisanService'
import type { Artisan } from '@/services/artisanService'

export type { Artisan }

export interface ArtisanContextValue {
  artisans: Artisan[]
  status: ResourceStatus
  error: string | null
  reload: () => void
}

const ArtisanContext = createContext<ArtisanContextValue | null>(null)

/** Perfis públicos de artesãos, carregados de `artisanService`. */
export function ArtisanProvider({ children }: { children: ReactNode }) {
  const { data: artisans, status, error, reload } = useResource(artisanService.list, [] as Artisan[])
  const value = useMemo<ArtisanContextValue>(() => ({ artisans, status, error, reload }), [artisans, status, error, reload])
  return <ArtisanContext.Provider value={value}>{children}</ArtisanContext.Provider>
}

export function useArtisans() {
  const context = useContext(ArtisanContext)
  if (!context) {
    throw new Error('useArtisans deve ser usado dentro de um ArtisanProvider')
  }
  return context
}

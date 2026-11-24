'use client'

import type { ReactNode } from 'react'
import { ArtisanProvider } from '@/context/ArtisanContext'
import { CatalogProvider } from '@/context/CatalogContext'
import { ProductFilterProvider } from '@/context/ProductFilterContext'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CatalogProvider>
      <ArtisanProvider>
        <ProductFilterProvider>{children}</ProductFilterProvider>
      </ArtisanProvider>
    </CatalogProvider>
  )
}

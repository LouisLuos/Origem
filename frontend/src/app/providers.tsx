'use client'

import type { ReactNode } from 'react'
import { ArtisanProvider } from '@/context/ArtisanContext'
import { AuthProvider } from '@/context/AuthContext'
import { CartProvider } from '@/context/CartContext'
import { CatalogProvider } from '@/context/CatalogContext'
import { FavoritesProvider } from '@/context/FavoritesContext'
import { OrderProvider } from '@/context/OrderContext'
import { ProductFilterProvider } from '@/context/ProductFilterContext'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CatalogProvider>
        <ArtisanProvider>
          <CartProvider>
            <OrderProvider>
              <FavoritesProvider>
                <ProductFilterProvider>{children}</ProductFilterProvider>
              </FavoritesProvider>
            </OrderProvider>
          </CartProvider>
        </ArtisanProvider>
      </CatalogProvider>
    </AuthProvider>
  )
}

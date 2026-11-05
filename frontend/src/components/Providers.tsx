'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from '@/context/AuthContext'
import { CatalogProvider } from '@/context/CatalogContext'
import { ArtisanProvider } from '@/context/ArtisanContext'
import { CartProvider } from '@/context/CartContext'
import { OrderProvider } from '@/context/OrderContext'
import { FavoritesProvider } from '@/context/FavoritesContext'
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


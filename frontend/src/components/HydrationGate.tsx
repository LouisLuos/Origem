'use client'

import type { ReactNode } from 'react'
import { LoadingBlock } from '@/components/AsyncState'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { Container } from '@/design-system'

/**
 * Sessão e carrinho vivem no localStorage, que só existe no navegador. As telas que redirecionam
 * ou preenchem formulários a partir deles só podem montar depois dessa leitura.
 */
export function HydrationGate({ children }: { children: ReactNode }) {
  const { hydrated: authHydrated } = useAuth()
  const { hydrated: cartHydrated } = useCart()

  if (!authHydrated || !cartHydrated) {
    return (
      <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
        <Container>
          <LoadingBlock />
        </Container>
      </main>
    )
  }

  return children
}

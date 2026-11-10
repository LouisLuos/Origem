'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useCatalog } from '@/context/CatalogContext'
import type { CatalogItem } from '@/context/CatalogContext'
import { cartService } from '@/services/cartService'
import type { CartItem } from '@/services/cartService'

export type { CartItem }

export const MAX_ITEM_QUANTITY = 10

/** Quantas unidades da peça cabem no carrinho: o limite por item ou o estoque, o que for menor. */
export function availableQuantity(product: { stock?: number }) {
  return Math.min(MAX_ITEM_QUANTITY, product.stock ?? MAX_ITEM_QUANTITY)
}

export interface CartLine {
  product: CatalogItem
  quantity: number
}

export interface CartContextValue {
  items: CartItem[]
  /** Itens do carrinho com os dados da peça no catálogo. */
  lines: CartLine[]
  /** `false` no HTML do servidor e na hidratação, enquanto o carrinho não foi lido do navegador. */
  hydrated: boolean
  itemCount: number
  addItem: (productId: string, quantity?: number) => void
  removeItem: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

/** Estado global do carrinho (itens e contagem), compartilhado entre `ProductCard`, `ProductDetail`, `Cart` e o ícone de carrinho no `Header`. */
export function CartProvider({ children }: { children: ReactNode }) {
  const { products, status: catalogStatus } = useCatalog()
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setItems(cartService.load())
    setHydrated(true)
  }, [])

  // Só grava depois de ler: senão o estado inicial vazio apagaria o carrinho salvo.
  useEffect(() => {
    if (hydrated) cartService.save(items)
  }, [items, hydrated])

  // Peças removidas ou pausadas saem do carrinho, para a contagem não divergir do que é exibido.
  useEffect(() => {
    if (!hydrated || catalogStatus !== 'ready') return
    setItems((prev) => {
      const kept = prev.filter((item) => products.some((product) => product.id === item.id))
      return kept.length === prev.length ? prev : kept
    })
  }, [hydrated, catalogStatus, products])

  const addItem = useCallback(
    (productId: string, quantity = 1) => {
      const product = products.find((candidate) => candidate.id === productId)
      const limit = product ? availableQuantity(product) : MAX_ITEM_QUANTITY
      if (limit === 0) return
      setItems((prev) => {
        const existing = prev.find((item) => item.id === productId)
        if (existing) {
          return prev.map((item) =>
            item.id === productId ? { ...item, quantity: Math.min(limit, item.quantity + quantity) } : item,
          )
        }
        return [...prev, { id: productId, quantity: Math.min(limit, quantity) }]
      })
    },
    [products],
  )

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== productId))
  }, [])

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((item) => item.id !== productId)
        : prev.map((item) => (item.id === productId ? { ...item, quantity } : item)),
    )
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      lines: items.flatMap((item) => {
        const product = products.find((candidate) => candidate.id === item.id)
        return product ? [{ product, quantity: item.quantity }] : []
      }),
      hydrated,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      addItem,
      removeItem,
      setQuantity,
      clearCart,
    }),
    [items, products, hydrated, addItem, removeItem, setQuantity, clearCart],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart deve ser usado dentro de um CartProvider')
  }
  return context
}

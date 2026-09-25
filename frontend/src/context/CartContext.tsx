import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { cartService } from '@/services/cartService'
import type { CartItem } from '@/services/cartService'

export type { CartItem }

export interface CartContextValue {
  items: CartItem[]
  itemCount: number
  addItem: (productId: string, quantity?: number) => void
  removeItem: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

/** Estado global do carrinho (itens e contagem), compartilhado entre `ProductCard`, `ProductDetail`, `Cart` e o ícone de carrinho no `Header`. */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(cartService.load)

  useEffect(() => {
    cartService.save(items)
  }, [items])

  const addItem = (productId: string, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.id === productId)
      if (existing) {
        return prev.map((item) => (item.id === productId ? { ...item, quantity: item.quantity + quantity } : item))
      }
      return [...prev, { id: productId, quantity }]
    })
  }

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== productId))
  }

  const setQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId)
      return
    }
    setItems((prev) => prev.map((item) => (item.id === productId ? { ...item, quantity } : item)))
  }

  const clearCart = () => setItems([])

  const itemCount = items.reduce((total, item) => total + item.quantity, 0)

  const value = useMemo<CartContextValue>(
    () => ({ items, itemCount, addItem, removeItem, setQuantity, clearCart }),
    [items, itemCount],
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

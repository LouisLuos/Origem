import { readStorage, writeStorage } from './storage'

export interface CartItem {
  id: string
  quantity: number
}

const CART_KEY = 'origem:cart'

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== 'object' || value === null) return false
  const { id, quantity } = value as Record<string, unknown>
  return typeof id === 'string' && typeof quantity === 'number' && quantity > 0
}

/** Carrinho persistido no navegador (equivalente a `GET/PUT /carrinho` quando houver backend). */
export const cartService = {
  load(): CartItem[] {
    const stored = readStorage<unknown>(CART_KEY, [])
    return Array.isArray(stored) ? stored.filter(isCartItem) : []
  },

  save(items: CartItem[]) {
    writeStorage(CART_KEY, items)
  },
}

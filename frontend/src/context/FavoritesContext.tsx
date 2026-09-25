import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { readStorage, writeStorage } from '@/services/storage'

export interface FavoritesContextValue {
  favorites: string[]
  isFavorite: (productId: string) => boolean
  toggleFavorite: (productId: string) => void
}

const FAVORITES_KEY = 'origem:favorites'

function loadFavorites(): string[] {
  const stored = readStorage<unknown>(FAVORITES_KEY, [])
  return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

/** Ids dos produtos favoritados, persistidos no localStorage (funciona também sem login). */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>(loadFavorites)

  const toggleFavorite = useCallback((productId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(productId) ? prev.filter((id) => id !== productId) : [productId, ...prev]
      writeStorage(FAVORITES_KEY, next)
      return next
    })
  }, [])

  const value = useMemo<FavoritesContextValue>(
    () => ({ favorites, isFavorite: (productId) => favorites.includes(productId), toggleFavorite }),
    [favorites, toggleFavorite],
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (!context) {
    throw new Error('useFavorites deve ser usado dentro de um FavoritesProvider')
  }
  return context
}

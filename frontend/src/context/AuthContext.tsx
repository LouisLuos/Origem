'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { authService } from '@/services/authService'
import type { User, UserRole } from '@/services/authService'
import { errorMessage } from '@/utils/errors'

export type { User, UserRole }

export interface AuthContextValue {
  user: User | null
  /** `false` no HTML do servidor e na hidratação, enquanto a sessão não foi lida do navegador. */
  hydrated: boolean
  /** Retornam uma mensagem de erro, ou `null` em caso de sucesso. */
  login: (email: string, password: string) => Promise<string | null>
  register: (name: string, email: string, password: string, role?: UserRole) => Promise<string | null>
  logout: () => void
  updateName: (name: string) => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const messageOf = (reason: unknown) => errorMessage(reason, 'Algo deu errado. Tente novamente.')

/** Sessão do usuário logado; a autenticação em si vive em `authService`. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setUser(authService.getSession())
    setHydrated(true)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      setUser(await authService.login(email, password))
      return null
    } catch (reason) {
      return messageOf(reason)
    }
  }, [])

  const register = useCallback(async (name: string, email: string, password: string, role?: UserRole) => {
    try {
      setUser(await authService.register(name, email, password, role))
      return null
    } catch (reason) {
      return messageOf(reason)
    }
  }, [])

  const logout = useCallback(() => {
    authService.logout()
    setUser(null)
  }, [])

  const updateName = useCallback(
    async (name: string) => {
      if (!user) return 'Você precisa estar logado.'
      try {
        setUser(await authService.updateName(user.email, name))
        return null
      } catch (reason) {
        return messageOf(reason)
      }
    },
    [user],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ user, hydrated, login, register, logout, updateName }),
    [user, hydrated, login, register, logout, updateName],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}

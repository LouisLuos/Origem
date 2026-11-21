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
  initializationError: string | null
  /** Retornam uma mensagem de erro, ou `null` em caso de sucesso. */
  login: (email: string, password: string) => Promise<string | null>
  register: (name: string, email: string, cpfCnpj: string, whatsapp: string, password: string) => Promise<string | null>
  logout: () => Promise<string | null>
  updateName: (name: string) => Promise<string | null>
  /** Recarrega a sessão do servidor (ex.: após a habilitação de artesão alterar o papel). */
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const messageOf = (reason: unknown) => errorMessage(reason, 'Algo deu errado. Tente novamente.')

/** Sessão do usuário logado; a autenticação em si vive em `authService`. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [initializationError, setInitializationError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void authService
      .getSession()
      .then((session) => {
        if (active) setUser(session)
      })
      .catch((reason: unknown) => {
        if (active) setInitializationError(messageOf(reason))
      })
      .finally(() => {
        if (active) setHydrated(true)
      })
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      setUser(await authService.login(email, password))
      return null
    } catch (reason) {
      return messageOf(reason)
    }
  }, [])

  const register = useCallback(
    async (name: string, email: string, cpfCnpj: string, whatsapp: string, password: string) => {
      try {
        setUser(await authService.register(name, email, cpfCnpj, whatsapp, password))
        return null
      } catch (reason) {
        return messageOf(reason)
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await authService.logout()
      setUser(null)
      return null
    } catch (reason) {
      return messageOf(reason)
    }
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

  const refreshSession = useCallback(async () => {
    try {
      setUser(await authService.getSession())
    } catch {
      // Mantém a sessão atual se o servidor estiver indisponível.
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, hydrated, initializationError, login, register, logout, updateName, refreshSession }),
    [user, hydrated, initializationError, login, register, logout, updateName, refreshSession],
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

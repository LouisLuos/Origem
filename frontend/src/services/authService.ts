import { apiRequest, ApiError } from './api'

export type UserRole = 'buyer' | 'artisan' | 'curator' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
}

interface UserResponse {
  user: User
}

export const authService = {
  async getSession(): Promise<User | null> {
    try {
      const { user } = await apiRequest<UserResponse>('/auth/me', undefined, 'Não foi possível validar sua sessão.')
      return user
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) return null
      throw reason
    }
  },

  async login(email: string, password: string): Promise<User> {
    const { user } = await apiRequest<UserResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      'Não foi possível entrar.',
    )
    return user
  },

  async register(
    name: string,
    email: string,
    cpfCnpj: string,
    whatsapp: string,
    password: string,
  ): Promise<User> {
    const { user } = await apiRequest<UserResponse>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ name, email, cpfCnpj, whatsapp, password }),
      },
      'Não foi possível criar sua conta.',
    )
    return user
  },

  async logout(): Promise<void> {
    await apiRequest<void>('/auth/logout', { method: 'POST' }, 'Não foi possível encerrar sua sessão.')
  },

  async updateName(_email: string, name: string): Promise<User> {
    const { user } = await apiRequest<UserResponse>(
      '/auth/profile',
      { method: 'PATCH', body: JSON.stringify({ name }) },
      'Não foi possível atualizar seu perfil.',
    )
    return user
  },

  async listUsers(): Promise<User[]> {
    const response = await apiRequest<{ users: User[] }>('/auth/users', undefined, 'Não foi possível carregar os usuários.')
    return response.users
  },
}

import { readStorage, removeStorage, simulateLatency, writeStorage } from './storage'

export type UserRole = 'buyer' | 'artisan' | 'admin'

export interface User {
  name: string
  email: string
  /** Ausente em sessões antigas: tratar como `buyer`. */
  role?: UserRole
}

interface StoredUser extends User {
  password: string
}

const USERS_KEY = 'origem:users'
const SESSION_KEY = 'origem:session'

/** Conta de demonstração do painel do artesão (dona das peças do Zé Caboclo no catálogo). */
export const DEMO_ARTISAN: StoredUser = {
  name: 'Zé Caboclo',
  email: 'artesao@origem.com',
  password: 'origem123',
  role: 'artisan',
}

/** Conta de demonstração do painel administrativo. */
export const DEMO_ADMIN: StoredUser = {
  name: 'Administração Origem',
  email: 'admin@origem.com',
  password: 'origem123',
  role: 'admin',
}

function readUsers(): StoredUser[] {
  const users = readStorage<StoredUser[]>(USERS_KEY, [])
  const missingDemos = [DEMO_ARTISAN, DEMO_ADMIN].filter((demo) => !users.some((candidate) => candidate.email === demo.email))
  return [...users, ...missingDemos]
}

/**
 * Autenticação SIMULADA: contas no localStorage, senha em texto puro (só para demonstração).
 * Equivalente a `POST /auth/login`, `POST /auth/register` e `GET /usuarios`. Erros de negócio rejeitam a
 * Promise com `Error` e mensagem em português.
 */
export const authService = {
  /** Leitura síncrona da sessão para evitar "piscar" a tela de login ao recarregar. */
  getSession(): User | null {
    return readStorage<User | null>(SESSION_KEY, null)
  },

  async login(email: string, password: string): Promise<User> {
    await simulateLatency(350)
    const normalized = email.trim().toLowerCase()
    const found = readUsers().find((candidate) => candidate.email === normalized)
    if (!found || found.password !== password) throw new Error('E-mail ou senha incorretos.')
    const user: User = { name: found.name, email: found.email, role: found.role }
    writeStorage(SESSION_KEY, user)
    return user
  },

  async register(name: string, email: string, password: string, role: UserRole = 'buyer'): Promise<User> {
    await simulateLatency(350)
    const normalized = email.trim().toLowerCase()
    const users = readUsers()
    if (users.some((candidate) => candidate.email === normalized)) throw new Error('Já existe uma conta com este e-mail.')
    const created: StoredUser = { name: name.trim(), email: normalized, password, role }
    writeStorage(USERS_KEY, [...users, created])
    const user: User = { name: created.name, email: created.email, role }
    writeStorage(SESSION_KEY, user)
    return user
  },

  logout() {
    removeStorage(SESSION_KEY)
  },

  async updateName(email: string, name: string): Promise<User> {
    await simulateLatency(200)
    const trimmed = name.trim()
    const users = readUsers()
    const target = users.find((stored) => stored.email === email)
    if (!target) throw new Error('Conta não encontrada.')
    writeStorage(
      USERS_KEY,
      users.map((stored) => (stored.email === email ? { ...stored, name: trimmed } : stored)),
    )
    const user: User = { name: trimmed, email, role: target.role }
    writeStorage(SESSION_KEY, user)
    return user
  },

  /** Contas cadastradas, sem a senha. */
  async listUsers(): Promise<User[]> {
    await simulateLatency(300)
    return readUsers().map(({ name, email, role }) => ({ name, email, role: role ?? 'buyer' }))
  },
}

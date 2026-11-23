import { apiRequest } from './api'

/** Recuperação de senha (HU-02). */
export const passwordRecoveryService = {
  async requestReset(email: string): Promise<string> {
    const { mensagem } = await apiRequest<{ mensagem: string }>(
      '/auth/forgot-password',
      { method: 'POST', body: JSON.stringify({ email: email.trim() }) },
      'Não foi possível solicitar a recuperação de senha.',
    )
    return mensagem
  },

  async resetPassword(token: string, password: string): Promise<string> {
    const { mensagem } = await apiRequest<{ mensagem: string }>(
      '/auth/reset-password',
      { method: 'POST', body: JSON.stringify({ token, password }) },
      'Não foi possível redefinir a senha.',
    )
    return mensagem
  },
}

export const passwordRequirements = [
  { label: 'Ao menos 8 caracteres', test: (value: string) => value.length >= 8 },
  { label: 'Uma letra maiúscula', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'Um número', test: (value: string) => /\d/.test(value) },
  { label: 'Um símbolo', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const

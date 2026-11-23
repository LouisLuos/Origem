/** Mesmas regras de `strongPasswordSchema` no backend (cadastro e redefinição de senha). */
export const passwordRequirements = [
  { label: 'Ao menos 8 caracteres', test: (value: string) => value.length >= 8 },
  { label: 'Uma letra maiúscula', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'Um número', test: (value: string) => /\d/.test(value) },
  { label: 'Um símbolo (ex.: ! @ # $)', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const

export function isStrongPassword(value: string): boolean {
  return passwordRequirements.every((requirement) => requirement.test(value)) && value.length <= 72
}

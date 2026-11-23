/** Espelho de `isValidCpfCnpj` em backend/src/validators/auth.validator.ts (aceita CNPJ alfanumérico). */
export function normalizeCpfCnpj(value: string): string {
  return value.replace(/[^0-9A-Z]/gi, '').toUpperCase()
}

function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false

  const calculateDigit = (slice: string, startFactor: number) => {
    let factor = startFactor
    const sum = [...slice].reduce((total, digit) => total + Number(digit) * factor--, 0)
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }

  return (
    calculateDigit(value.slice(0, 9), 10) === Number(value[9]) &&
    calculateDigit(value.slice(0, 10), 11) === Number(value[10])
  )
}

function isValidCnpj(value: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false

  const calculateDigit = (slice: string, weights: number[]) => {
    const sum = [...slice].reduce(
      (total, character, index) => total + (character.charCodeAt(0) - 48) * (weights[index] ?? 0),
      0,
    )
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  const firstDigit = calculateDigit(value.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const secondDigit = calculateDigit(value.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return firstDigit === Number(value[12]) && secondDigit === Number(value[13])
}

export function isValidCpfCnpj(value: string): boolean {
  const normalized = normalizeCpfCnpj(value)
  return normalized.length === 11 ? isValidCpf(normalized) : isValidCnpj(normalized)
}

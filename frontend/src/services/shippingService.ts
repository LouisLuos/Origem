import { catalogRequest } from './catalogRequest'

export interface ShippingQuote {
  pecaId: string
  cepDestino: string
  valorBrl: number
  prazoEstimadoDias: number
}

export function formatCepInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function isValidCep(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  return digits.length === 8 && digits !== '00000000'
}

/**
 * Simulação logística de frete e prazo na página de detalhes da peça (HU-07 Cenário 3).
 * Consome `POST /api/v1/frete/simular`.
 */
export const shippingService = {
  async simulate(pecaId: string, cepDestino: string): Promise<ShippingQuote> {
    return catalogRequest<ShippingQuote>('/frete/simular', {
      method: 'POST',
      body: JSON.stringify({
        pecaId,
        cepDestino: cepDestino.replace(/\D/g, ''),
      }),
    })
  },
}


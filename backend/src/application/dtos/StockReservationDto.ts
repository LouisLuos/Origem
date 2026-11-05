import { z } from 'zod'

export const StockReservationLineSchema = z.object({
  productId: z.string().min(1, 'Informe o identificador do produto (productId).'),
  quantity: z
    .number()
    .int('A quantidade deve ser um número inteiro.')
    .positive('A quantidade deve ser maior que zero.'),
})

export const StockReservationRequestSchema = z.object({
  lines: z
    .array(StockReservationLineSchema)
    .min(1, 'Informe ao menos uma linha de reserva.'),
})

export type StockReservationLineInput = z.infer<typeof StockReservationLineSchema>
export type StockReservationRequestInput = z.infer<typeof StockReservationRequestSchema>


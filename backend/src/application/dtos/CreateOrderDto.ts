import { z } from 'zod'
import { StockReservationLineSchema } from './StockReservationDto'

export const ShippingAddressSchema = z.object({
  phone: z.string().min(1, 'Informe o telefone para contato.'),
  zip: z.string().min(1, 'Informe o CEP.'),
  street: z.string().min(1, 'Informe o logradouro.'),
  number: z.string().min(1, 'Informe o número.'),
  complement: z.string().default(''),
  neighborhood: z.string().min(1, 'Informe o bairro.'),
  city: z.string().min(1, 'Informe a cidade.'),
  state: z.string().min(2, 'Informe a UF.'),
})

export const CreateOrderRequestSchema = z.object({
  orderId: z.string().optional(),
  userEmail: z.string().email().optional(),
  customerName: z.string().min(1, 'Informe o nome completo do comprador.'),
  customerEmail: z.string().email('Informe um e-mail válido do comprador.'),
  shippingAddress: ShippingAddressSchema,
  paymentMethod: z.enum(['pix', 'card', 'boleto']),
  lines: z
    .array(StockReservationLineSchema)
    .min(1, 'O pedido deve conter ao menos um item.'),
})

export type CreateOrderRequestInput = z.infer<typeof CreateOrderRequestSchema>


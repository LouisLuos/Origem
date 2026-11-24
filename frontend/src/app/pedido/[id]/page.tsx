import type { Metadata } from 'next'
import { OrderConfirmation } from '@/views/OrderConfirmation'

export const metadata: Metadata = { title: 'Pedido confirmado' }

export default function Page() {
  return <OrderConfirmation />
}

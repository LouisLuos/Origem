import type { Metadata } from 'next'
import { HydrationGate } from '@/components/HydrationGate'
import { Checkout } from '@/views/Checkout'

export const metadata: Metadata = { title: 'Finalizar compra' }

export default function Page() {
  return (
    <HydrationGate>
      <Checkout />
    </HydrationGate>
  )
}

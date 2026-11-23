import type { Metadata } from 'next'
import { HydrationGate } from '@/components/HydrationGate'
import { Account } from '@/views/Account'

export const metadata: Metadata = { title: 'Minha conta' }

export default function Page() {
  return (
    <HydrationGate>
      <Account />
    </HydrationGate>
  )
}

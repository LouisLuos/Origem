import type { Metadata } from 'next'
import { HydrationGate } from '@/components/HydrationGate'
import { AdminPanel } from '@/views/AdminPanel'

export const metadata: Metadata = { title: 'Administração' }

export default function Page() {
  return (
    <HydrationGate>
      <AdminPanel />
    </HydrationGate>
  )
}

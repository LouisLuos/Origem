import type { Metadata } from 'next'
import { HydrationGate } from '@/components/HydrationGate'
import { ArtisanPanel } from '@/views/ArtisanPanel'

export const metadata: Metadata = { title: 'Painel do artesão' }

export default function Page() {
  return (
    <HydrationGate>
      <ArtisanPanel />
    </HydrationGate>
  )
}

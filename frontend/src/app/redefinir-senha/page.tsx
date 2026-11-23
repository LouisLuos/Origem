import type { Metadata } from 'next'
import { Suspense } from 'react'
import { HydrationGate } from '@/components/HydrationGate'
import { ResetPassword } from '@/views/ResetPassword'

export const metadata: Metadata = { title: 'Criar nova senha', referrer: 'no-referrer' }

export default function Page() {
  return (
    <HydrationGate>
      <Suspense>
        <ResetPassword />
      </Suspense>
    </HydrationGate>
  )
}

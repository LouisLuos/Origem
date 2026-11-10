import type { Metadata } from 'next'
import { Suspense } from 'react'
import { HydrationGate } from '@/components/HydrationGate'
import { Login } from '@/views/Login'

export const metadata: Metadata = { title: 'Entrar' }

export default function Page() {
  return (
    <HydrationGate>
      <Suspense>
        <Login />
      </Suspense>
    </HydrationGate>
  )
}

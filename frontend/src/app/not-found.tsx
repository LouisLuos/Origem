import type { Metadata } from 'next'
import { NotFound } from '@/views/NotFound'

export const metadata: Metadata = { title: 'Página não encontrada' }

export default function Page() {
  return <NotFound />
}

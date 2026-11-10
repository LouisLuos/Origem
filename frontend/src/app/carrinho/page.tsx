import type { Metadata } from 'next'
import { Cart } from '@/views/Cart'

export const metadata: Metadata = { title: 'Carrinho' }

export default function Page() {
  return <Cart />
}

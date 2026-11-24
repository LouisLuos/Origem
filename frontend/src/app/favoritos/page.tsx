import type { Metadata } from 'next'
import { Favorites } from '@/views/Favorites'

export const metadata: Metadata = { title: 'Favoritos' }

export default function Page() {
  return <Favorites />
}

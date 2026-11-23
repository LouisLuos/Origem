import type { Metadata } from 'next'
import { Notifications } from '@/views/Notifications'

export const metadata: Metadata = { title: 'Avisos' }

export default function Page() {
  return <Notifications />
}

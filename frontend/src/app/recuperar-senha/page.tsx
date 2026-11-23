import type { Metadata } from 'next'
import { ForgotPassword } from '@/views/ForgotPassword'

export const metadata: Metadata = { title: 'Recuperar senha' }

export default function Page() {
  return <ForgotPassword />
}

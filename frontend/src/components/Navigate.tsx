'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Redireciona ao ser renderizado, sem deixar a página atual no histórico. */
export function Navigate({ to }: { to: string }) {
  const router = useRouter()

  useEffect(() => {
    router.replace(to)
  }, [router, to])

  return null
}

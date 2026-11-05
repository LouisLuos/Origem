'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export const REDIRECT_FROM_KEY = 'origem:redirect_from'

export function Redirect({ to, from, replace = false }: { to: string; from?: string; replace?: boolean }) {
  const router = useRouter()

  useEffect(() => {
    if (from && typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(REDIRECT_FROM_KEY, from)
      } catch {
        // ignorado
      }
    }
    if (replace) {
      router.replace(to)
    } else {
      router.push(to)
    }
  }, [to, from, replace, router])

  return null
}


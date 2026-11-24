'use client'

import { useCallback, useState } from 'react'
import { errorMessage } from '@/utils/errors'

/** Executa uma operação do catálogo e guarda o erro para mostrar na tela, se houver. */
export function useCatalogAction() {
  const [actionError, setActionError] = useState<string | null>(null)

  const run = useCallback(async (operation: () => Promise<void>) => {
    setActionError(null)
    try {
      await operation()
    } catch (reason) {
      setActionError(errorMessage(reason, 'Não foi possível concluir a operação.'))
    }
  }, [])

  return { actionError, run }
}

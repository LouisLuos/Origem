import { useCallback, useEffect, useRef, useState } from 'react'

export type ResourceStatus = 'loading' | 'ready' | 'error'

/**
 * Carrega dados de um service assíncrono ao montar e expõe estado de carregamento/erro.
 * `fetcher` deve ter identidade estável (ex.: `catalogService.list`).
 */
export function useResource<T>(fetcher: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial)
  const [status, setStatus] = useState<ResourceStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const reload = useCallback(() => {
    const id = ++requestId.current
    setStatus('loading')
    setError(null)
    fetcher()
      .then((result) => {
        if (id !== requestId.current) return
        setData(result)
        setStatus('ready')
      })
      .catch((reason: unknown) => {
        if (id !== requestId.current) return
        setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os dados.')
        setStatus('error')
      })
  }, [fetcher])

  useEffect(() => {
    reload()
    return () => {
      requestId.current++
    }
  }, [reload])

  return { data, setData, status, error, reload }
}

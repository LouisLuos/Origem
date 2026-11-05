import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

/**
 * Middleware de logging estruturado JSON (RNF-09) sem exposição de dados pessoais sensíveis (LGPD).
 */
export function createRequestLogger(silent = false) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const traceId = (req.headers['x-trace-id'] as string | undefined) ?? randomUUID()
    res.setHeader('X-Trace-Id', traceId)

    if (silent) {
      next()
      return
    }

    const startedAt = Date.now()
    res.on('finish', () => {
      const durationMs = Date.now() - startedAt
      const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO'
      console.info(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level,
          traceId,
          action: `${req.method} ${req.originalUrl}`,
          statusCode: res.statusCode,
          durationMs,
        }),
      )
    })

    next()
  }
}


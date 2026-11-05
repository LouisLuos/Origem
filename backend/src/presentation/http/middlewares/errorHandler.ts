import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { DomainError } from '../../../domain/errors'

/**
 * Handler global de exceções HTTP compatível 100% com `contratos-api.md` (`{ erro: "..." }`)
 * e blindado contra vazamento de stack traces internos (Segurança / LGPD).
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof DomainError) {
    res.status(err.suggestedHttpStatus).json({ erro: err.message })
    return
  }

  if (err instanceof ZodError) {
    const firstIssue = err.issues[0]
    const message = firstIssue?.message ?? 'Dados de entrada inválidos.'
    res.status(400).json({ erro: message })
    return
  }

  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
    res.status(400).json({ erro: 'Corpo JSON malformado.' })
    return
  }

  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: 'Erro interno não tratado na camada HTTP.',
      error: err instanceof Error ? err.message : String(err),
    }),
  )

  res.status(500).json({ erro: 'Erro interno no servidor.' })
}


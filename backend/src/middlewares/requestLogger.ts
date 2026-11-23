import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export const CORRELATION_ID_REGEX = /^[a-zA-Z0-9._-]{8,64}$/;

/**
 * Aceita apenas cabeçalho `X-Request-Id` seguro contra CRLF/log injection;
 * caso contrário, gera um UUID v4 aleatório.
 */
export function resolveCorrelationId(rawHeader: string | string[] | undefined): string {
  if (typeof rawHeader === 'string' && CORRELATION_ID_REGEX.test(rawHeader)) {
    return rawHeader;
  }

  return crypto.randomUUID();
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, url } = req;
  const correlationId = resolveCorrelationId(req.headers['x-request-id']);

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    console.log(`[HTTP] [${correlationId}] ${method} ${url} -> ${statusCode} (${duration}ms)`);
  });

  next();
}

import type { NextFunction, Request, Response } from 'express';
import type {
  AuthIdentityProvider,
  AuthRequestCredentials,
} from '../repositories/contracts/auth.contracts.js';
import {
  ATELIE_ERROR_CODES,
  unconfiguredAuthIdentityProvider,
} from '../repositories/unconfiguredHu03.repository.js';
import { AppError } from '../utils/AppError.js';

type ExtractedCredentials =
  | { readonly kind: 'MISSING' }
  | { readonly kind: 'MALFORMED' }
  | { readonly kind: 'PRESENT'; readonly credentials: AuthRequestCredentials };

const BEARER_HEADER_REGEX = /^Bearer\s+(\S+)$/i;

/**
 * Extrai credenciais estritamente dos cabeçalhos padrão `Authorization` e `Cookie`.
 * Nunca confia em `x-user-id`, `x-user-role`, `req.body` ou `req.query` para identidade.
 */
export function extractAuthCredentials(req: Request): ExtractedCredentials {
  const rawAuthHeader = req.headers.authorization;
  let bearerToken: string | undefined;

  if (rawAuthHeader !== undefined) {
    if (typeof rawAuthHeader !== 'string') {
      return { kind: 'MALFORMED' };
    }

    const match = BEARER_HEADER_REGEX.exec(rawAuthHeader.trim());
    if (!match || !match[1]) {
      return { kind: 'MALFORMED' };
    }
    bearerToken = match[1];
  }

  const rawCookieHeader = req.headers.cookie;
  const cookieHeader =
    typeof rawCookieHeader === 'string' && rawCookieHeader.trim().length > 0
      ? rawCookieHeader.trim()
      : undefined;

  if (!bearerToken && !cookieHeader) {
    return { kind: 'MISSING' };
  }

  return {
    kind: 'PRESENT',
    credentials: {
      ...(bearerToken ? { bearerToken } : {}),
      ...(cookieHeader ? { cookieHeader } : {}),
    },
  };
}

/**
 * Cria o middleware de autenticação desacoplado do provedor real da .
 * Opera em modo fail-closed: ausência/invalidade retorna HTTP 401; provedor ausente ou
 * indisponível retorna HTTP 503 sem nunca permitir identidades simuladas em produção.
 */
export function createAuthMiddleware(
  authProvider: AuthIdentityProvider = unconfiguredAuthIdentityProvider,
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const extracted = extractAuthCredentials(req);

      if (extracted.kind === 'MISSING') {
        next(new AppError('Autenticação obrigatória.', 401));
        return;
      }

      if (extracted.kind === 'MALFORMED') {
        next(new AppError('Cabeçalho de autenticação inválido.', 401));
        return;
      }

      const verification = await authProvider.verify(extracted.credentials);

      if (verification.status === 'AUTHENTICATED') {
        if (
          typeof verification.identity?.userId !== 'string' ||
          verification.identity.userId.trim().length === 0
        ) {
          next(new AppError('Autenticação inválida ou expirada.', 401));
          return;
        }

        req.auth = verification.identity;
        next();
        return;
      }

      if (verification.status === 'UNAUTHENTICATED') {
        next(new AppError('Autenticação inválida ou expirada.', 401));
        return;
      }

      next(
        new AppError(
          verification.reason || 'Serviço de autenticação real ainda não integrado ao backend.',
          503,
          ATELIE_ERROR_CODES.AUTENTICACAO_INDISPONIVEL,
        ),
      );
    } catch (err) {
      if (err instanceof AppError) {
        next(err);
        return;
      }

      next(
        new AppError(
          'Serviço de autenticação indisponível no momento.',
          503,
          ATELIE_ERROR_CODES.AUTENTICACAO_INDISPONIVEL,
        ),
      );
    }
  };
}

/** Instância padrão conectada ao adaptador não configurado até a entrega da . */
export const authenticate = createAuthMiddleware(unconfiguredAuthIdentityProvider);

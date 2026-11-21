import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import type {
  AuthIdentityProvider,
  AuthRequestCredentials,
} from '../repositories/contracts/auth.contracts.js';
import type { AuthUserRecord } from '../repositories/contracts/authentication.contracts.js';

const COOKIE_NAME = 'origem_session';
const jwtSecret = new TextEncoder().encode(env.JWT_SECRET);

export interface SessionTokenService {
  issue(user: AuthUserRecord): Promise<string>;
}

export const sessionTokenService: SessionTokenService = {
  async issue(user) {
    return new SignJWT({ email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(env.JWT_EXPIRES_IN)
      .sign(jwtSecret);
  },
};

function readCookieToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== COOKIE_NAME) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function extractSessionToken(credentials: AuthRequestCredentials): string | null {
  return credentials.bearerToken ?? readCookieToken(credentials.cookieHeader);
}

export const jwtAuthIdentityProvider: AuthIdentityProvider = {
  async verify(credentials) {
    const token = extractSessionToken(credentials);
    if (!token) return { status: 'UNAUTHENTICATED', reason: 'Sessão inválida ou expirada.' };

    try {
      const { payload } = await jwtVerify(token, jwtSecret, { algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
        return { status: 'UNAUTHENTICATED', reason: 'Sessão inválida ou expirada.' };
      }
      return {
        status: 'AUTHENTICATED',
        identity: {
          userId: payload.sub,
          email: payload.email,
          ...(typeof payload.jti === 'string' ? { sessionId: payload.jti } : {}),
        },
      };
    } catch {
      return { status: 'UNAUTHENTICATED', reason: 'Sessão inválida ou expirada.' };
    }
  },
};

export const authCookie = {
  name: COOKIE_NAME,
  options: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
  clearOptions: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  },
};

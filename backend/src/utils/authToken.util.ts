import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import type {
  AuthIdentityProvider,
  AuthRequestCredentials,
} from '../repositories/contracts/auth.contracts.js';
import type { AuthUserRecord } from '../repositories/contracts/authentication.contracts.js';
import { isUuid } from './uuid.util.js';

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

/** `INEXISTENTE` quando o usuário do token não existe mais; `null` quando nenhuma sessão foi revogada. */
export type ConsultaSessoesValidasDesde = (usuarioId: string) => Promise<Date | null | 'INEXISTENTE'>;

const consultarSessoesValidasDesdeNoBanco: ConsultaSessoesValidasDesde = async (usuarioId) => {
  if (!isUuid(usuarioId)) return 'INEXISTENTE';
  const { prisma } = await import('../config/database.js');
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { sessoesValidasDesde: true },
  });
  return usuario ? usuario.sessoesValidasDesde : 'INEXISTENTE';
};

/** HU-02, Cenário 3: tokens emitidos antes da última redefinição de senha deixam de valer. */
export function sessaoRevogada(emitidoEmSegundos: number | undefined, validasDesde: Date | null): boolean {
  if (!validasDesde) return false;
  if (typeof emitidoEmSegundos !== 'number') return true;
  // `iat` tem resolução de segundos: o token emitido no mesmo segundo da troca continua válido.
  return emitidoEmSegundos < Math.floor(validasDesde.getTime() / 1000);
}

const SESSAO_INVALIDA = { status: 'UNAUTHENTICATED', reason: 'Sessão inválida ou expirada.' } as const;

export function createJwtAuthIdentityProvider(
  consultarSessoesValidasDesde: ConsultaSessoesValidasDesde = consultarSessoesValidasDesdeNoBanco,
): AuthIdentityProvider {
  return {
    async verify(credentials) {
      const token = extractSessionToken(credentials);
      if (!token) return SESSAO_INVALIDA;

      let payload;
      try {
        ({ payload } = await jwtVerify(token, jwtSecret, { algorithms: ['HS256'] }));
      } catch {
        return SESSAO_INVALIDA;
      }
      if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
        return SESSAO_INVALIDA;
      }

      // Falha ao consultar o banco propaga para o middleware, que responde 503 (fail-closed).
      const validasDesde = await consultarSessoesValidasDesde(payload.sub);
      if (validasDesde === 'INEXISTENTE' || sessaoRevogada(payload.iat, validasDesde)) {
        return SESSAO_INVALIDA;
      }

      return {
        status: 'AUTHENTICATED',
        identity: {
          userId: payload.sub,
          email: payload.email,
          ...(typeof payload.jti === 'string' ? { sessionId: payload.jti } : {}),
        },
      };
    },
  };
}

export const jwtAuthIdentityProvider = createJwtAuthIdentityProvider();

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

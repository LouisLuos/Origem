/**
 * Contratos desacoplados de identidade autenticada para integração futura com a HU-01.
 *
 * A HU-03 NÃO implementa emissão, assinatura ou validação própria de tokens JWT.
 * O middleware de autenticação consome exclusivamente esta porta e opera em modo
 * fail-closed enquanto o provedor oficial da HU-01 não estiver integrado.
 */

export interface AuthenticatedIdentity {
  /** Identificador confiável (UUID) do usuário autenticado na tabela `usuarios`. */
  readonly userId: string;
  /** E-mail normalizado do usuário autenticado, quando disponibilizado pelo provedor. */
  readonly email?: string;
  /** Identificador da sessão ou token (`jti`) para correlação em trilhas de auditoria. */
  readonly sessionId?: string;
}

export interface AuthRequestCredentials {
  /** Token extraído do cabeçalho `Authorization: Bearer <token>`, se presente. */
  readonly bearerToken?: string;
  /** Cabeçalho bruto `Cookie`, caso a HU-01 utilize cookies HttpOnly de sessão. */
  readonly cookieHeader?: string;
}

export type AuthVerificationResult =
  | { readonly status: 'AUTHENTICATED'; readonly identity: AuthenticatedIdentity }
  | { readonly status: 'UNAUTHENTICATED'; readonly reason: string }
  | { readonly status: 'PROVIDER_UNAVAILABLE'; readonly reason: string };

/**
 * Porta de verificação de identidade a ser implementada pela entrega da HU-01.
 */
export interface AuthIdentityProvider {
  verify(credentials: AuthRequestCredentials): Promise<AuthVerificationResult>;
}

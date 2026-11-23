import type { AuthenticatedIdentity } from '../repositories/contracts/auth.contracts.js';
import type { ContextoAcessoAtelie } from '../repositories/contracts/hu03.contracts.js';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      auth?: AuthenticatedIdentity;
      atelierAccess?: ContextoAcessoAtelie;
      rawBody?: Buffer;
    }
  }
}

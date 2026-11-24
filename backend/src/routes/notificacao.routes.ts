import { Router } from 'express';
import { createNotificacaoController } from '../controllers/notificacao.controller.js';
import { createAuthMiddleware } from '../middlewares/auth.middleware.js';
import type { AuthIdentityProvider } from '../repositories/contracts/auth.contracts.js';
import type { NotificacaoLogRepository } from '../repositories/contracts/notificacoes.contracts.js';
import { unconfiguredAuthIdentityProvider } from '../repositories/unconfiguredHu03.repository.js';
import { jwtAuthIdentityProvider } from '../utils/authToken.util.js';

export interface NotificacaoRoutesDeps {
  readonly authProvider?: AuthIdentityProvider;
  readonly logRepository?: NotificacaoLogRepository;
}

export function createNotificacaoRoutes(deps?: NotificacaoRoutesDeps): Router {
  const router = Router();
  const authenticate = createAuthMiddleware(
    deps?.authProvider ?? unconfiguredAuthIdentityProvider,
  );
  const controller = createNotificacaoController(deps?.logRepository);

  router.get('/minhas', authenticate, controller.listarMinhas);

  return router;
}

export const notificacaoRoutes = createNotificacaoRoutes({
  authProvider: jwtAuthIdentityProvider,
});

import { Router } from 'express';
import { createReservaEstoqueController } from '../controllers/reservaEstoque.controller.js';
import { createAuthMiddleware } from '../middlewares/auth.middleware.js';
import type { AuthIdentityProvider } from '../repositories/contracts/auth.contracts.js';
import { unconfiguredAuthIdentityProvider } from '../repositories/unconfiguredHu03.repository.js';
import type { ReservaEstoqueService } from '../services/reservaEstoque.service.js';
import { jwtAuthIdentityProvider } from '../utils/authToken.util.js';

export interface EstoqueRoutesDeps {
  readonly authProvider?: AuthIdentityProvider;
  readonly reservaService?: ReservaEstoqueService;
}

export function createEstoqueRoutes(deps?: EstoqueRoutesDeps): Router {
  const router = Router();
  const authenticate = createAuthMiddleware(
    deps?.authProvider ?? unconfiguredAuthIdentityProvider,
  );
  const controller = createReservaEstoqueController(deps?.reservaService);

  router.post('/reservas', authenticate, controller.reservar);
  router.get('/reservas/minhas', authenticate, controller.listarMinhas);
  router.post('/reservas/itens/:reservaId/cancelar', authenticate, controller.cancelarItem);
  router.post('/reservas/:grupoId/cancelar', authenticate, controller.cancelarGrupo);
  router.delete('/reservas/:grupoId', authenticate, controller.cancelarGrupo);
  router.post('/reservas/:grupoId/confirmar', authenticate, controller.confirmarGrupo);

  return router;
}

export const estoqueRoutes = createEstoqueRoutes({
  authProvider: jwtAuthIdentityProvider,
});

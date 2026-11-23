import { Router } from 'express';
import { createPedidoPagamentoController } from '../controllers/pedidoPagamento.controller.js';
import { createAuthMiddleware } from '../middlewares/auth.middleware.js';
import type { AuthIdentityProvider } from '../repositories/contracts/auth.contracts.js';
import { unconfiguredAuthIdentityProvider } from '../repositories/unconfiguredHu03.repository.js';
import type { CheckoutPagamentoService } from '../services/checkoutPagamento.service.js';
import { jwtAuthIdentityProvider } from '../utils/authToken.util.js';

export interface PedidoRoutesDeps {
  readonly authProvider?: AuthIdentityProvider;
  readonly service?: CheckoutPagamentoService;
}

export function createPedidoRoutes(deps?: PedidoRoutesDeps): Router {
  const router = Router();
  const authenticate = createAuthMiddleware(
    deps?.authProvider ?? unconfiguredAuthIdentityProvider,
  );
  const controller = createPedidoPagamentoController(deps?.service);

  router.post('/cotar-frete', authenticate, controller.cotarFrete);
  router.post('/checkout', authenticate, controller.checkout);
  router.get('/meus', authenticate, controller.listarMeus);
  router.get('/:pedidoId', authenticate, controller.obterPorId);

  return router;
}

export const pedidoRoutes = createPedidoRoutes({
  authProvider: jwtAuthIdentityProvider,
});

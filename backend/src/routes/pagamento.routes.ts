import { Router } from 'express';
import { createPedidoPagamentoController } from '../controllers/pedidoPagamento.controller.js';
import type { CheckoutPagamentoService } from '../services/checkoutPagamento.service.js';

export interface PagamentoRoutesDeps {
  readonly service?: CheckoutPagamentoService;
}

export function createPagamentoRoutes(deps?: PagamentoRoutesDeps): Router {
  const router = Router();
  const controller = createPedidoPagamentoController(deps?.service);

  // Autenticação estritamente por assinatura/segredo oficial do provedor de pagamento (sem JWT de usuário)
  router.post('/webhook/:gateway', controller.receberWebhook);

  return router;
}

export const pagamentoRoutes = createPagamentoRoutes();

import type { NextFunction, Request, Response } from 'express';
import {
  checkoutPagamentoService,
  type CheckoutPagamentoService,
} from '../services/checkoutPagamento.service.js';
import { AppError } from '../utils/AppError.js';
import {
  validarCotacaoFreteCheckout,
  validarCriacaoCheckout,
  validarGatewayWebhookParam,
  validarParametroPedidoIdOuCodigo,
} from '../validators/pedidoPagamento.validator.js';

export function createPedidoPagamentoController(
  service: CheckoutPagamentoService = checkoutPagamentoService,
) {
  return {
    /** POST /api/v1/pedidos/cotar-frete */
    async cotarFrete(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        if (!req.auth?.userId) {
          throw new AppError('Autenticação obrigatória para cotar frete do checkout.', 401);
        }

        const entrada = validarCotacaoFreteCheckout(req.body);
        const cotacao = await service.cotarFreteCheckout(req.auth.userId, entrada);
        res.status(200).json(cotacao);
      } catch (err) {
        next(err);
      }
    },

    /** POST /api/v1/pedidos/checkout */
    async checkout(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        if (!req.auth?.userId) {
          throw new AppError('Autenticação obrigatória para finalizar a compra.', 401);
        }

        const entrada = validarCriacaoCheckout(req.body, req.headers['idempotency-key']);
        const resultado = await service.criarCheckout(req.auth.userId, entrada, {
          correlationId: req.correlationId,
        });
        res.status(resultado.idempotente ? 200 : 201).json(resultado);
      } catch (err) {
        next(err);
      }
    },

    /** GET /api/v1/pedidos/meus */
    async listarMeus(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        if (!req.auth?.userId) {
          throw new AppError('Autenticação obrigatória para consultar seus pedidos.', 401);
        }

        const dados = await service.listarMeusPedidos(req.auth.userId);
        res.status(200).json({ dados });
      } catch (err) {
        next(err);
      }
    },

    /** GET /api/v1/pedidos/:pedidoId */
    async obterPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        if (!req.auth?.userId) {
          throw new AppError('Autenticação obrigatória para consultar pedido.', 401);
        }

        const filtro = validarParametroPedidoIdOuCodigo(req.params.pedidoId);
        const pedido = await service.obterPedidoPorId(req.auth.userId, filtro);
        res.status(200).json({ pedido });
      } catch (err) {
        next(err);
      }
    },

    /** POST /api/v1/pagamentos/webhook/:gateway */
    async receberWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const gatewayParam = validarGatewayWebhookParam(req.params.gateway);
        const rawBody =
          req.rawBody && req.rawBody.length > 0
            ? req.rawBody
            : Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');

        const queryNormalizada: Record<string, string | string[] | undefined> = {};
        for (const [k, v] of Object.entries(req.query)) {
          if (typeof v === 'string' || Array.isArray(v)) {
            queryNormalizada[k] = v as string | string[];
          }
        }

        const resultado = await service.processarWebhook({
          gatewayParam,
          headers: req.headers,
          query: queryNormalizada,
          rawBody,
          body: req.body,
          correlationId: req.correlationId,
        });

        res.status(200).json(resultado);
      } catch (err) {
        next(err);
      }
    },
  };
}

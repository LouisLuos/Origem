import express, { Router, type NextFunction, type Request, type Response } from 'express';
import { createPecaController } from '../controllers/peca.controller.js';
import { createAuthMiddleware } from '../middlewares/auth.middleware.js';
import { createAtelierRbacMiddleware } from '../middlewares/rbac.middleware.js';
import type { AuthIdentityProvider } from '../repositories/contracts/auth.contracts.js';
import type { AtelieAutorizacaoRepository } from '../repositories/contracts/hu03.contracts.js';
import {
  unconfiguredAtelieAutorizacaoRepository,
  unconfiguredAuthIdentityProvider,
} from '../repositories/unconfiguredHu03.repository.js';
import type { PecaService } from '../services/peca.service.js';
import { AppError } from '../utils/AppError.js';
import { jwtAuthIdentityProvider } from '../utils/authToken.util.js';
import { LIMITE_CORPO_CRIACAO_PECA_BYTES } from '../utils/fotoPeca.util.js';
import { securityAuditService, type SecurityAuditService } from '../utils/securityAudit.util.js';

/** Caminho de montagem (relativo a /api/v1) das rotas de escrita de peças. */
export const PECAS_ROUTE_PATH = '/atelies/:atelieId/pecas';

const jsonComFotos = express.json({ limit: LIMITE_CORPO_CRIACAO_PECA_BYTES });

/**
 * Parser JSON exclusivo da criação de peças: aceita o corpo maior com fotos em base64 (o parser
 * global mantém o limite padrão) e converte erros do body-parser em `AppError`.
 * Deve ser registrado antes do `express.json()` global.
 */
export function pecaJsonBodyParser(req: Request, res: Response, next: NextFunction): void {
  jsonComFotos(req, res, (err?: unknown) => {
    if (!err) {
      next();
      return;
    }
    const tipo = (err as { type?: string }).type;
    if (tipo === 'entity.too.large') {
      next(new AppError('O conjunto de fotos excede o tamanho máximo permitido para a publicação.', 413));
      return;
    }
    if (tipo === 'entity.parse.failed') {
      next(new AppError('Corpo da requisição não é um JSON válido.', 400));
      return;
    }
    next(err);
  });
}

export interface PecaRoutesDeps {
  readonly authProvider?: AuthIdentityProvider;
  readonly autorizacaoRepository?: AtelieAutorizacaoRepository;
  readonly auditService?: SecurityAuditService;
  readonly pecaService?: PecaService;
}

/**
 * Rotas de escrita de peças no escopo do ateliê (HU-05). Montadas em `/atelies/:atelieId/pecas`
 * com `mergeParams`, para que o RBAC contextual leia o `atelieId` da URL.
 */
export function createPecaRoutes(deps?: PecaRoutesDeps): Router {
  const router = Router({ mergeParams: true });
  const authenticate = createAuthMiddleware(deps?.authProvider ?? unconfiguredAuthIdentityProvider);
  const requireAtelierPermission = createAtelierRbacMiddleware({
    autorizacaoRepository: deps?.autorizacaoRepository ?? unconfiguredAtelieAutorizacaoRepository,
    auditService: deps?.auditService ?? securityAuditService,
  });
  const controller = createPecaController(deps?.pecaService);

  // POST /api/v1/atelies/:atelieId/pecas
  router.post('/', authenticate, requireAtelierPermission('GERENCIAR_CATALOGO'), controller.criar);

  return router;
}

export const pecaRoutes = createPecaRoutes({ authProvider: jwtAuthIdentityProvider });

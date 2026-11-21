import { Router } from 'express';
import {
  atelieGovernancaController,
  createAtelieGovernancaController,
} from '../controllers/atelieGovernanca.controller.js';
import { createAuthMiddleware } from '../middlewares/auth.middleware.js';
import { createAtelierRbacMiddleware } from '../middlewares/rbac.middleware.js';
import type { AuthIdentityProvider } from '../repositories/contracts/auth.contracts.js';
import type { AtelieAutorizacaoRepository } from '../repositories/contracts/hu03.contracts.js';
import {
  unconfiguredAtelieAutorizacaoRepository,
  unconfiguredAuthIdentityProvider,
} from '../repositories/unconfiguredHu03.repository.js';
import { jwtAuthIdentityProvider } from '../utils/authToken.util.js';
import type { AtelieFinanceiroService } from '../services/atelieFinanceiro.service.js';
import type { CuradoriaService } from '../services/curadoria.service.js';
import { securityAuditService, type SecurityAuditService } from '../utils/securityAudit.util.js';

export interface AtelieRoutesDeps {
  readonly authProvider?: AuthIdentityProvider;
  readonly autorizacaoRepository?: AtelieAutorizacaoRepository;
  readonly auditService?: SecurityAuditService;
  readonly financeiroService?: AtelieFinanceiroService;
  readonly curadoriaService?: CuradoriaService;
}

export function createAtelieRoutes(deps?: AtelieRoutesDeps): Router {
  const router = Router();
  const authenticate = createAuthMiddleware(
    deps?.authProvider ?? unconfiguredAuthIdentityProvider,
  );
  const requireAtelierPermission = createAtelierRbacMiddleware({
    autorizacaoRepository: deps?.autorizacaoRepository ?? unconfiguredAtelieAutorizacaoRepository,
    auditService: deps?.auditService ?? securityAuditService,
  });
  const controller =
    deps?.financeiroService || deps?.curadoriaService
      ? createAtelieGovernancaController({
          financeiroService: deps.financeiroService,
          curadoriaService: deps.curadoriaService,
        })
      : atelieGovernancaController;

  // Rota estática obrigatoriamente registrada antes de /:atelieId/*
  router.get('/meus-vinculos', authenticate, controller.listarMeusVinculos);

  // Operações financeiras privadas e gestão de Chave Pix (exclusivas do titular do ateliê)
  router.get(
    '/:atelieId/financeiro',
    authenticate,
    requireAtelierPermission('CONSULTAR_DADOS_FINANCEIROS'),
    controller.consultarFinanceiro,
  );
  router.patch(
    '/:atelieId/chave-pix',
    authenticate,
    requireAtelierPermission('ALTERAR_CHAVE_PIX'),
    controller.atualizarChavePix,
  );

  // Gestão de curadores vinculados ao ateliê (exclusiva do titular do ateliê)
  router.get(
    '/:atelieId/curadores',
    authenticate,
    requireAtelierPermission('GERENCIAR_CURADORES'),
    controller.listarCuradores,
  );
  router.post(
    '/:atelieId/curadores',
    authenticate,
    requireAtelierPermission('GERENCIAR_CURADORES'),
    controller.associarCurador,
  );
  router.delete(
    '/:atelieId/curadores/:curadorUsuarioId',
    authenticate,
    requireAtelierPermission('GERENCIAR_CURADORES'),
    controller.removerCurador,
  );

  return router;
}

export const atelieRoutes = createAtelieRoutes({ authProvider: jwtAuthIdentityProvider });

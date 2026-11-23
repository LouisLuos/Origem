import { Router, type NextFunction, type Request, type Response } from 'express';
import { createAuthMiddleware } from '../middlewares/auth.middleware.js';
import type { AuthIdentityProvider } from '../repositories/contracts/auth.contracts.js';
import type { AtelieAutorizacaoRepository } from '../repositories/contracts/hu03.contracts.js';
import { unconfiguredAuthIdentityProvider } from '../repositories/unconfiguredHu03.repository.js';
import { unconfiguredAtelieAutorizacaoRepository } from '../repositories/unconfiguredHu03.repository.js';
import { prismaAtelieAutorizacaoRepository } from '../repositories/prismaHu03.repository.js';
import { atelieCadastroService, type AtelieCadastroService } from '../services/atelieCadastro.service.js';
import { createAtelierRbacMiddleware } from '../middlewares/rbac.middleware.js';
import { AppError } from '../utils/AppError.js';
import { jwtAuthIdentityProvider } from '../utils/authToken.util.js';
import { securityAuditService, type SecurityAuditService } from '../utils/securityAudit.util.js';
import { atelieIdParamSchema } from '../validators/hu03.validator.js';
import { validarAtualizacaoAtelie, validarCriacaoAtelie } from '../validators/atelie.validator.js';

export interface AtelieCadastroRoutesDeps {
  readonly authProvider?: AuthIdentityProvider;
  readonly service?: AtelieCadastroService;
  readonly autorizacaoRepository?: AtelieAutorizacaoRepository;
  readonly auditService?: SecurityAuditService;
}

/** Cadastro e edição atômica do ateliê e do endereço de expedição. */
export function createAtelieCadastroRoutes(deps?: AtelieCadastroRoutesDeps): Router {
  const router = Router();
  const authenticate = createAuthMiddleware(deps?.authProvider ?? unconfiguredAuthIdentityProvider);
  const service = deps?.service ?? atelieCadastroService;
  const requireAtelierPermission = createAtelierRbacMiddleware({
    autorizacaoRepository: deps?.autorizacaoRepository ?? unconfiguredAtelieAutorizacaoRepository,
    auditService: deps?.auditService ?? securityAuditService,
  });

  router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const usuarioId = req.auth?.userId;
      if (!usuarioId) throw new AppError('Autenticação obrigatória.', 401);
      const dados = validarCriacaoAtelie(req.body);
      res.status(201).json(await service.criar(usuarioId, dados));
    } catch (err) {
      next(err);
    }
  });

  router.get(
    '/:atelieId/dados',
    authenticate,
    requireAtelierPermission('EDITAR_DADOS_ATELIE'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth?.userId) throw new AppError('Autenticação obrigatória.', 401);
        const { atelieId } = atelieIdParamSchema.parse(req.params);
        res.status(200).json(await service.consultar(atelieId, req.auth.userId));
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/:atelieId/dados',
    authenticate,
    requireAtelierPermission('EDITAR_DADOS_ATELIE'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth?.userId) throw new AppError('Autenticação obrigatória.', 401);
        const { atelieId } = atelieIdParamSchema.parse(req.params);
        const dados = validarAtualizacaoAtelie(req.body);
        res.status(200).json(await service.atualizar(atelieId, req.auth.userId, dados));
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export const atelieCadastroRoutes = createAtelieCadastroRoutes({
  authProvider: jwtAuthIdentityProvider,
  autorizacaoRepository: prismaAtelieAutorizacaoRepository,
  auditService: securityAuditService,
});

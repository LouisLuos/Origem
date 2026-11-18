import { Router } from 'express';
import { artesaoController } from '../controllers/artesao.controller.js';
import {
  createHabilitacaoArtesaoController,
  habilitacaoArtesaoController,
} from '../controllers/habilitacaoArtesao.controller.js';
import { createAuthMiddleware } from '../middlewares/auth.middleware.js';
import type { AuthIdentityProvider } from '../repositories/contracts/auth.contracts.js';
import { unconfiguredAuthIdentityProvider } from '../repositories/unconfiguredHu03.repository.js';
import type { HabilitacaoArtesaoService } from '../services/habilitacaoArtesao.service.js';

export interface ArtesaoRoutesDeps {
  readonly authProvider?: AuthIdentityProvider;
  readonly habilitacaoService?: HabilitacaoArtesaoService;
}

export function createArtesaoRoutes(deps?: ArtesaoRoutesDeps): Router {
  const router = Router();
  const authenticate = createAuthMiddleware(
    deps?.authProvider ?? unconfiguredAuthIdentityProvider,
  );
  const habilitacaoController = deps?.habilitacaoService
    ? createHabilitacaoArtesaoController(deps.habilitacaoService)
    : habilitacaoArtesaoController;

  // GET /api/v1/artesaos
  router.get('/', artesaoController.listar);

  // POST /api/v1/artesaos/habilitacao (rota estática antes de /:id)
  router.post('/habilitacao', authenticate, habilitacaoController.habilitar);

  // GET /api/v1/artesaos/:id
  router.get('/:id', artesaoController.detalhar);

  return router;
}

export const artesaoRoutes = createArtesaoRoutes();

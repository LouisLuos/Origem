import { Router, type NextFunction, type Request, type Response } from 'express';
import { createAuthMiddleware } from '../middlewares/auth.middleware.js';
import type { AuthIdentityProvider } from '../repositories/contracts/auth.contracts.js';
import { unconfiguredAuthIdentityProvider } from '../repositories/unconfiguredHu03.repository.js';
import { atelieCadastroService, type AtelieCadastroService } from '../services/atelieCadastro.service.js';
import { AppError } from '../utils/AppError.js';
import { jwtAuthIdentityProvider } from '../utils/authToken.util.js';
import { validarCriacaoAtelie } from '../validators/atelie.validator.js';

export interface AtelieCadastroRoutesDeps {
  readonly authProvider?: AuthIdentityProvider;
  readonly service?: AtelieCadastroService;
}

/** HU-04: POST /api/v1/atelies — cadastro atômico de ateliê e endereço de expedição. */
export function createAtelieCadastroRoutes(deps?: AtelieCadastroRoutesDeps): Router {
  const router = Router();
  const authenticate = createAuthMiddleware(deps?.authProvider ?? unconfiguredAuthIdentityProvider);
  const service = deps?.service ?? atelieCadastroService;

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

  return router;
}

export const atelieCadastroRoutes = createAtelieCadastroRoutes({ authProvider: jwtAuthIdentityProvider });

import { Router, type NextFunction, type Request, type Response } from 'express';
import { createAuthMiddleware } from '../middlewares/auth.middleware.js';
import type { AuthIdentityProvider } from '../repositories/contracts/auth.contracts.js';
import { unconfiguredAuthIdentityProvider } from '../repositories/unconfiguredHu03.repository.js';
import {
  enderecoCompradorService,
  type EnderecoCompradorService,
} from '../services/enderecoComprador.service.js';
import { AppError } from '../utils/AppError.js';
import { jwtAuthIdentityProvider } from '../utils/authToken.util.js';
import { validarEnderecoComprador } from '../validators/endereco.validator.js';

export interface EnderecoRoutesDeps {
  readonly authProvider?: AuthIdentityProvider;
  readonly service?: EnderecoCompradorService;
}

function usuarioAutenticado(req: Request): string {
  const usuarioId = req.auth?.userId;
  if (!usuarioId) throw new AppError('Autenticação obrigatória.', 401);
  return usuarioId;
}

function enderecoIdParam(req: Request): string {
  const { enderecoId } = req.params;
  if (typeof enderecoId !== 'string' || enderecoId.length === 0) {
    throw new AppError('Endereço não encontrado.', 404, 'ENDERECO_NAO_ENCONTRADO');
  }
  return enderecoId;
}

/** Livro de endereços do comprador (HU-11): cada usuário acessa apenas os próprios endereços. */
export function createEnderecoRoutes(deps?: EnderecoRoutesDeps): Router {
  const router = Router();
  const authenticate = createAuthMiddleware(deps?.authProvider ?? unconfiguredAuthIdentityProvider);
  const service = deps?.service ?? enderecoCompradorService;

  router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json({ dados: await service.listar(usuarioAutenticado(req)) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const usuarioId = usuarioAutenticado(req);
      const dados = validarEnderecoComprador(req.body);
      res.status(201).json(await service.criar(usuarioId, dados));
    } catch (err) {
      next(err);
    }
  });

  router.patch(
    '/:enderecoId',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const usuarioId = usuarioAutenticado(req);
        const dados = validarEnderecoComprador(req.body);
        res.status(200).json(await service.atualizar(usuarioId, enderecoIdParam(req), dados));
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/:enderecoId',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await service.remover(usuarioAutenticado(req), enderecoIdParam(req));
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export const enderecoRoutes = createEnderecoRoutes({ authProvider: jwtAuthIdentityProvider });

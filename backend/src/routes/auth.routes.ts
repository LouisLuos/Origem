import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { createAuthMiddleware } from '../middlewares/auth.middleware.js';
import { authRepository } from '../repositories/auth.repository.js';
import type { AuthRepository, AuthUserRecord } from '../repositories/contracts/authentication.contracts.js';
import { authService, createAuthService, type AuthService } from '../services/auth.service.js';
import { AppError } from '../utils/AppError.js';
import {
  authCookie,
  jwtAuthIdentityProvider,
  sessionTokenService,
  type SessionTokenService,
} from '../utils/authToken.util.js';
import { passwordHasher } from '../utils/password.util.js';
import {
  loginBodySchema,
  registerBodySchema,
  updateProfileBodySchema,
} from '../validators/auth.validator.js';

export interface AuthRoutesDeps {
  readonly service?: AuthService;
  readonly repository?: AuthRepository;
  readonly tokenService?: SessionTokenService;
}

const ROLE_ORDER = ['ADMIN', 'ARTESAO', 'CURADOR', 'COMPRADOR'] as const;

function toUserResponse(user: AuthUserRecord) {
  const role = ROLE_ORDER.find((candidate) => user.roles.includes(candidate)) ?? 'COMPRADOR';
  const frontendRole = {
    ADMIN: 'admin',
    ARTESAO: 'artisan',
    CURADOR: 'curator',
    COMPRADOR: 'buyer',
  }[role];
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: frontendRole,
  };
}

function setSessionCookie(res: Response, token: string): void {
  res.cookie(authCookie.name, token, authCookie.options);
}

export function createAuthRoutes(deps?: AuthRoutesDeps): Router {
  const router = Router();
  const repository = deps?.repository ?? authRepository;
  const service =
    deps?.service ??
    (deps?.repository
      ? createAuthService({ repository: deps.repository, passwordHasher })
      : authService);
  const tokenService = deps?.tokenService ?? sessionTokenService;
  const authenticate = createAuthMiddleware(jwtAuthIdentityProvider);

  router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = registerBodySchema.parse(req.body);
      const user = await service.register({
        name: input.name,
        email: input.email,
        cpfCnpj: input.cpfCnpj,
        whatsapp: input.whatsapp,
        password: input.password,
      });
      setSessionCookie(res, await tokenService.issue(user));
      res.status(201).json({ user: toUserResponse(user) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = loginBodySchema.parse(req.body);
      const user = await service.login(input.email, input.password);
      setSessionCookie(res, await tokenService.issue(user));
      res.status(200).json({ user: toUserResponse(user) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.userId) throw new AppError('Autenticação obrigatória.', 401);
      const user = await service.getActiveUser(req.auth.userId);
      res.status(200).json({ user: toUserResponse(user) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', (_req: Request, res: Response) => {
    res.clearCookie(authCookie.name, authCookie.clearOptions);
    res.status(204).send();
  });

  router.patch('/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.userId) throw new AppError('Autenticação obrigatória.', 401);
      const { name } = updateProfileBodySchema.parse(req.body);
      const user = await service.updateName(req.auth.userId, name);
      res.status(200).json({ user: toUserResponse(user) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/users', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.userId) throw new AppError('Autenticação obrigatória.', 401);
      const requester = await repository.findById(req.auth.userId);
      if (!requester || !requester.roles.includes('ADMIN')) {
        throw new AppError('Acesso restrito a administradores.', 403);
      }
      const users = await service.listUsers();
      res.status(200).json({ users: users.map(toUserResponse) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const authRoutes = createAuthRoutes();

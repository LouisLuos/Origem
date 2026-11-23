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
  MENSAGEM_SOLICITACAO_RECUPERACAO,
  recuperacaoSenhaService,
  type RecuperacaoSenhaService,
} from '../services/recuperacaoSenha.service.js';
import { sanitizarErroProvedor } from '../utils/notificationPrivacy.util.js';
import {
  forgotPasswordBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  updateProfileBodySchema,
} from '../validators/auth.validator.js';

export interface AuthRoutesDeps {
  readonly service?: AuthService;
  readonly repository?: AuthRepository;
  readonly tokenService?: SessionTokenService;
  readonly recuperacaoService?: RecuperacaoSenhaService;
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
  const recuperacaoService = deps?.recuperacaoService ?? recuperacaoSenhaService;
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

  // HU-02, Cenários 1 e 2: a resposta é a mesma e não espera o processamento,
  // para não revelar pela mensagem nem pelo tempo se o e-mail tem conta.
  router.post('/forgot-password', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = forgotPasswordBodySchema.parse(req.body);
      recuperacaoService.solicitar(email).catch((error: unknown) => {
        console.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            evento: 'RECUPERACAO_SENHA_FALHA',
            erro: sanitizarErroProvedor(error),
          }),
        );
      });
      res.status(200).json({ mensagem: MENSAGEM_SOLICITACAO_RECUPERACAO });
    } catch (error) {
      next(error);
    }
  });

  router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, password } = resetPasswordBodySchema.parse(req.body);
      await recuperacaoService.redefinir(token, password);
      res.clearCookie(authCookie.name, authCookie.clearOptions);
      res.status(200).json({
        mensagem: 'Senha redefinida. Por segurança, todas as sessões foram encerradas. Entre com a nova senha.',
      });
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

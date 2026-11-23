import type { NextFunction, Request, Response } from 'express';
import { prismaNotificacaoLogRepository } from '../repositories/prismaNotificacaoLog.repository.js';
import type { NotificacaoLogRepository } from '../repositories/contracts/notificacoes.contracts.js';
import { AppError } from '../utils/AppError.js';

export function createNotificacaoController(
  logRepository: NotificacaoLogRepository = prismaNotificacaoLogRepository,
) {
  return {
    /**
     * GET /api/v1/notificacoes/minhas
     * Retorna apenas os registros mascarados de auditoria do próprio usuário autenticado.
     */
    async listarMinhas(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        if (!req.auth?.userId) {
          throw new AppError('Autenticação obrigatória para consultar notificações.', 401);
        }

        const limiteBruto =
          typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 25;
        const limite =
          Number.isInteger(limiteBruto) && limiteBruto > 0 ? Math.min(limiteBruto, 100) : 25;

        const dados = await logRepository.listarPorUsuario(req.auth.userId, limite);
        res.status(200).json({ dados });
      } catch (err) {
        next(err);
      }
    },
  };
}

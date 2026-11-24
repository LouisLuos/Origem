import type { NextFunction, Request, Response } from 'express';
import {
  habilitacaoArtesaoService,
  type HabilitacaoArtesaoService,
} from '../services/habilitacaoArtesao.service.js';
import { AppError } from '../utils/AppError.js';
import { habilitarArtesaoBodySchema } from '../validators/hu03.validator.js';

export function createHabilitacaoArtesaoController(
  service: HabilitacaoArtesaoService = habilitacaoArtesaoService,
) {
  return {
    async habilitar(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        if (!req.auth?.userId) {
          throw new AppError('Autenticação obrigatória.', 401);
        }

        const input = habilitarArtesaoBodySchema.parse(req.body);
        const resultado = await service.habilitar(req.auth.userId, input);
        res.status(201).json(resultado);
      } catch (err) {
        next(err);
      }
    },
  };
}

export const habilitacaoArtesaoController = createHabilitacaoArtesaoController();

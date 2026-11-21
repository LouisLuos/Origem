import type { NextFunction, Request, Response } from 'express';
import { pecaService, type PecaService } from '../services/peca.service.js';
import { AppError } from '../utils/AppError.js';
import { validarCriacaoPeca } from '../validators/peca.validator.js';

export function createPecaController(service: PecaService = pecaService) {
  return {
    /** POST /api/v1/atelies/:atelieId/pecas — publica uma peça (HU-05). */
    async criar(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        // O ateliê vem do contexto já autorizado pelo RBAC (nunca do corpo da requisição).
        const atelieId = req.atelierAccess?.atelieId;
        if (!atelieId) {
          throw new AppError('Contexto de ateliê não autorizado para esta operação.', 403);
        }

        const dados = validarCriacaoPeca(req.body);
        const peca = await service.criar(atelieId, dados);
        res.status(201).json(peca);
      } catch (err) {
        next(err);
      }
    },
  };
}

export const pecaController = createPecaController();

import type { NextFunction, Request, Response } from 'express';
import { pecaService, type PecaService } from '../services/peca.service.js';
import { AppError } from '../utils/AppError.js';
import {
  pecaIdParamSchema,
  validarAtualizacaoEstoquePeca,
  validarCriacaoPeca,
} from '../validators/peca.validator.js';

export function createPecaController(service: PecaService = pecaService) {
  return {
    /** GET /api/v1/atelies/:atelieId/pecas — lista peças do ateliê autorizado. */
    async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const atelieId = req.atelierAccess?.atelieId;
        if (!atelieId) {
          throw new AppError('Contexto de ateliê não autorizado para esta operação.', 403);
        }

        const dados = await service.listarPorAtelie(atelieId);
        res.status(200).json({ dados });
      } catch (err) {
        next(err);
      }
    },

    /** POST /api/v1/atelies/:atelieId/pecas — publica uma peça. */
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

    /** PATCH /api/v1/atelies/:atelieId/pecas/:pecaId/estoque — ajusta saldo em estoque da peça. */
    async atualizarEstoque(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const atelieId = req.atelierAccess?.atelieId;
        if (!atelieId) {
          throw new AppError('Contexto de ateliê não autorizado para esta operação.', 403);
        }

        const { pecaId } = pecaIdParamSchema.parse(req.params);
        const dados = validarAtualizacaoEstoquePeca(req.body);
        const peca = await service.atualizarEstoque(atelieId, pecaId, dados);
        res.status(200).json(peca);
      } catch (err) {
        next(err);
      }
    },
  };
}

export const pecaController = createPecaController();

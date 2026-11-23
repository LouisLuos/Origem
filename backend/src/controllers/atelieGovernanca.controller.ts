import type { NextFunction, Request, Response } from 'express';
import {
  atelieFinanceiroService,
  type AtelieFinanceiroService,
} from '../services/atelieFinanceiro.service.js';
import {
  curadoriaService,
  type CuradoriaService,
} from '../services/curadoria.service.js';
import { AppError } from '../utils/AppError.js';
import {
  associarCuradorBodySchema,
  atelieIdParamSchema,
  atualizarChavePixBodySchema,
  curadorVinculoParamsSchema,
} from '../validators/hu03.validator.js';

export interface AtelieGovernancaControllerDeps {
  readonly financeiroService?: AtelieFinanceiroService;
  readonly curadoriaService?: CuradoriaService;
}

export function createAtelieGovernancaController(deps?: AtelieGovernancaControllerDeps) {
  const financeiro = deps?.financeiroService ?? atelieFinanceiroService;
  const curadoria = deps?.curadoriaService ?? curadoriaService;

  return {
    async listarMeusVinculos(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        if (!req.auth?.userId) {
          throw new AppError('Autenticação obrigatória.', 401);
        }

        const dados = await curadoria.listarMeusVinculos(req.auth.userId);
        res.status(200).json({ dados });
      } catch (err) {
        next(err);
      }
    },

    async consultarFinanceiro(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const { atelieId } = atelieIdParamSchema.parse(req.params);
        const resumo = await financeiro.consultarResumoFinanceiro(atelieId);
        res.status(200).json(resumo);
      } catch (err) {
        next(err);
      }
    },

    async atualizarChavePix(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        if (!req.auth?.userId) {
          throw new AppError('Autenticação obrigatória.', 401);
        }

        const { atelieId } = atelieIdParamSchema.parse(req.params);
        const input = atualizarChavePixBodySchema.parse(req.body);
        const resultado = await financeiro.atualizarChavePix(atelieId, req.auth.userId, input);
        res.status(200).json(resultado);
      } catch (err) {
        next(err);
      }
    },

    async listarCuradores(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const { atelieId } = atelieIdParamSchema.parse(req.params);
        const dados = await curadoria.listarCuradores(atelieId);
        res.status(200).json({ dados });
      } catch (err) {
        next(err);
      }
    },

    async associarCurador(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        if (!req.auth?.userId) {
          throw new AppError('Autenticação obrigatória.', 401);
        }

        const { atelieId } = atelieIdParamSchema.parse(req.params);
        const input = associarCuradorBodySchema.parse(req.body);
        const vinculo = await curadoria.associarCurador(atelieId, req.auth.userId, input);
        res.status(201).json(vinculo);
      } catch (err) {
        next(err);
      }
    },

    async removerCurador(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        if (!req.auth?.userId) {
          throw new AppError('Autenticação obrigatória.', 401);
        }

        const { atelieId, curadorUsuarioId } = curadorVinculoParamsSchema.parse(req.params);
        await curadoria.removerCurador(atelieId, req.auth.userId, curadorUsuarioId);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  };
}

export const atelieGovernancaController = createAtelieGovernancaController();

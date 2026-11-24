import type { NextFunction, Request, Response } from 'express';
import {
  reservaEstoqueService,
  type ReservaEstoqueService,
} from '../services/reservaEstoque.service.js';
import { AppError } from '../utils/AppError.js';
import {
  validarCriacaoReserva,
  validarUuidParam,
} from '../validators/reserva.validator.js';

export function createReservaEstoqueController(
  service: ReservaEstoqueService = reservaEstoqueService,
) {
  return {
    /** POST /api/v1/estoque/reservas — cria reserva temporária transacional (15 min). */
    async reservar(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        if (!req.auth?.userId) {
          throw new AppError('Autenticação obrigatória para reservar peças.', 401);
        }

        const entrada = validarCriacaoReserva(req.body, req.headers['idempotency-key']);
        const resultado = await service.reservar(req.auth.userId, entrada);
        res.status(resultado.idempotente ? 200 : 201).json(resultado);
      } catch (err) {
        next(err);
      }
    },

    /** GET /api/v1/estoque/reservas/minhas — lista reservas do comprador autenticado. */
    async listarMinhas(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        if (!req.auth?.userId) {
          throw new AppError('Autenticação obrigatória para consultar reservas.', 401);
        }

        const agora = new Date();
        const dados = await service.listarMinhas(req.auth.userId, agora);
        res.status(200).json({ servidorAgora: agora.toISOString(), dados });
      } catch (err) {
        next(err);
      }
    },

    /** POST /api/v1/estoque/reservas/:grupoId/cancelar e DELETE /api/v1/estoque/reservas/:grupoId */
    async cancelarGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        if (!req.auth?.userId) {
          throw new AppError('Autenticação obrigatória para cancelar reserva.', 401);
        }

        const grupoId = validarUuidParam(req.params.grupoId, 'Identificador do grupo de reserva');
        const resultado = await service.cancelarGrupo(grupoId, req.auth.userId);
        res.status(200).json(resultado);
      } catch (err) {
        next(err);
      }
    },

    /** POST /api/v1/estoque/reservas/itens/:reservaId/cancelar */
    async cancelarItem(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        if (!req.auth?.userId) {
          throw new AppError('Autenticação obrigatória para cancelar item de reserva.', 401);
        }

        const reservaId = validarUuidParam(req.params.reservaId, 'Identificador da reserva');
        const resultado = await service.cancelarItem(reservaId, req.auth.userId);
        res.status(200).json(resultado);
      } catch (err) {
        next(err);
      }
    },

    /** POST /api/v1/estoque/reservas/:grupoId/confirmar */
    async confirmarGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        if (!req.auth?.userId) {
          throw new AppError('Autenticação obrigatória para confirmar reserva.', 401);
        }

        const grupoId = validarUuidParam(req.params.grupoId, 'Identificador do grupo de reserva');
        const resultado = await service.confirmarGrupo(grupoId, req.auth.userId);
        res.status(200).json(resultado);
      } catch (err) {
        next(err);
      }
    },
  };
}

export const reservaEstoqueController = createReservaEstoqueController();

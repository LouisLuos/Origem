import type { NextFunction, Request, Response } from 'express';
import { freteService as defaultFreteService, type FreteService } from '../services/frete.service.js';
import { validarSimulacaoFreteInput } from '../validators/frete.validator.js';

export function createFreteController(service: FreteService = defaultFreteService) {
  return {
    async simular(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const input = validarSimulacaoFreteInput(req.body);
        const resultado = await service.simularParaPeca(input);
        res.status(200).json(resultado);
      } catch (err) {
        next(err);
      }
    },
  };
}

export const freteController = createFreteController();


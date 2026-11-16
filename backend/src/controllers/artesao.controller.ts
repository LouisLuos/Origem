import type { Request, Response, NextFunction } from 'express';
import { artesaoService } from '../services/artesao.service.js';
import { AppError } from '../utils/AppError.js';
import {
  artesaoIdParamSchema,
  listarArtesaosQuerySchema,
} from '../validators/catalog.validator.js';

export const artesaoController = {
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listarArtesaosQuerySchema.parse(req.query);
      const resultado = await artesaoService.listar(query);
      res.status(200).json(resultado);
    } catch (err) {
      next(err);
    }
  },

  async detalhar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = artesaoIdParamSchema.parse(req.params);
      const artesao = await artesaoService.buscarPorId(id);

      if (!artesao) {
        throw new AppError('Artesão não encontrado.', 404);
      }

      res.status(200).json(artesao);
    } catch (err) {
      next(err);
    }
  },
};

import type { Request, Response, NextFunction } from 'express';
import { artesaoService } from '../services/artesao.service.js';
import { AppError } from '../utils/AppError.js';

export const artesaoController = {
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const q = typeof req.query.q === 'string' ? req.query.q : typeof req.query.nome === 'string' ? req.query.nome : undefined;
      const hub = typeof req.query.hub === 'string' ? req.query.hub : undefined;
      const technique = typeof req.query.technique === 'string' ? req.query.technique : undefined;

      const resultado = await artesaoService.listar({ page, limit, q, hub, technique });
      res.status(200).json(resultado);
    } catch (err) {
      next(err);
    }
  },

  async detalhar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      if (!id) {
        throw new AppError('Identificador do artesão é obrigatório.', 400);
      }

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

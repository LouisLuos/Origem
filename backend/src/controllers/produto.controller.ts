import type { Request, Response, NextFunction } from 'express';
import { produtoService } from '../services/produto.service.js';
import { AppError } from '../utils/AppError.js';

export const produtoController = {
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const technique = typeof req.query.technique === 'string' ? req.query.technique : undefined;
      const hub = typeof req.query.hub === 'string' ? req.query.hub : undefined;

      const resultado = await produtoService.listar({ page, limit, technique, hub });
      res.status(200).json(resultado);
    } catch (err) {
      next(err);
    }
  },

  async detalhar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      if (!id) {
        throw new AppError('Identificador do produto é obrigatório.', 400);
      }

      const produto = await produtoService.buscarPorId(id);

      if (!produto) {
        throw new AppError(`Produto com id '${id}' não encontrado.`, 404);
      }

      res.status(200).json(produto);
    } catch (err) {
      next(err);
    }
  },
};

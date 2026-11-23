import type { Request, Response, NextFunction } from 'express';
import { produtoService } from '../services/produto.service.js';
import { AppError } from '../utils/AppError.js';
import {
  listarProdutosQuerySchema,
  produtoIdParamSchema,
} from '../validators/catalog.validator.js';

export const produtoController = {
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listarProdutosQuerySchema.parse(req.query);
      const resultado = await produtoService.listar(query);
      res.status(200).json(resultado);
    } catch (err) {
      next(err);
    }
  },

  async detalhar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = produtoIdParamSchema.parse(req.params);
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

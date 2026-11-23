import { Router } from 'express';
import {
  createProdutoController,
  produtoController as defaultProdutoController,
} from '../controllers/produto.controller.js';
import type { ProdutoService } from '../services/produto.service.js';

export function createProdutoRoutes(service?: ProdutoService): Router {
  const router = Router();
  const controller = service ? createProdutoController(service) : defaultProdutoController;

  // GET /api/v1/produtos
  router.get('/', controller.listar);

  // GET /api/v1/produtos/:id
  router.get('/:id', controller.detalhar);

  return router;
}

export const produtoRoutes = createProdutoRoutes();

import { Router } from 'express';
import { produtoController } from '../controllers/produto.controller.js';

export const produtoRoutes = Router();

// GET /api/v1/produtos
produtoRoutes.get('/', produtoController.listar);

// GET /api/v1/produtos/:id
produtoRoutes.get('/:id', produtoController.detalhar);

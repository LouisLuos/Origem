import { Router } from 'express';
import { artesaoController } from '../controllers/artesao.controller.js';

export const artesaoRoutes = Router();

// GET /api/v1/artesaos
artesaoRoutes.get('/', artesaoController.listar);

// GET /api/v1/artesaos/:id
artesaoRoutes.get('/:id', artesaoController.detalhar);

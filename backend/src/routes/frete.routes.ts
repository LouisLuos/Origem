import { Router } from 'express';
import {
  createFreteController,
  freteController as defaultFreteController,
} from '../controllers/frete.controller.js';
import type { FreteService } from '../services/frete.service.js';

export function createFreteRoutes(service?: FreteService): Router {
  const router = Router();
  const controller = service ? createFreteController(service) : defaultFreteController;

  // POST /api/v1/frete/simular
  router.post('/simular', controller.simular);

  return router;
}

export const freteRoutes = createFreteRoutes();


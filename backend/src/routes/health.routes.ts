import { Router } from 'express';
import { HealthController } from '../controllers/health.controller.js';

export const healthRoutes = Router();

healthRoutes.get('/', HealthController.check);

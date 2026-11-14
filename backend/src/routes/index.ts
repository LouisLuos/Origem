import { Router } from 'express';
import { healthRoutes } from './health.routes.js';

export const routes = Router();

// Endpoint de saúde / health check
routes.use('/health', healthRoutes);

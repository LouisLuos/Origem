import { Router } from 'express';
import { healthRoutes } from './health.routes.js';
import { produtoRoutes } from './produto.routes.js';
import { artesaoRoutes } from './artesao.routes.js';
import { atelieRoutes } from './atelie.routes.js';

export const routes = Router();

// Endpoint de saúde / health check
routes.use('/health', healthRoutes);

// Endpoints de catálogo e produtos
routes.use('/produtos', produtoRoutes);

// Endpoints de mestres e artesãos
routes.use('/artesaos', artesaoRoutes);

// Endpoints de governança de ateliês, finanças protegidas e curadores (HU-03)
routes.use('/atelies', atelieRoutes);



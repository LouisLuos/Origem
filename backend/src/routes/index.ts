import { Router } from 'express';
import { healthRoutes } from './health.routes.js';
import { produtoRoutes } from './produto.routes.js';
import { artesaoRoutes } from './artesao.routes.js';
import { atelieRoutes } from './atelie.routes.js';
import { authRoutes } from './auth.routes.js';
import { PECAS_ROUTE_PATH, pecaRoutes } from './peca.routes.js';

export const routes = Router();

// Autenticação e sessão de usuários (HU-01)
routes.use('/auth', authRoutes);

// Endpoint de saúde / health check
routes.use('/health', healthRoutes);

// Endpoints de catálogo e produtos
routes.use('/produtos', produtoRoutes);

// Endpoints de mestres e artesãos
routes.use('/artesaos', artesaoRoutes);

// Cadastro de peças no escopo do ateliê (HU-05)
routes.use(PECAS_ROUTE_PATH, pecaRoutes);

// Endpoints de governança de ateliês, finanças protegidas e curadores (HU-03)
routes.use('/atelies', atelieRoutes);


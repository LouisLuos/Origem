import { Router } from 'express';
import { healthRoutes } from './health.routes.js';
import { produtoRoutes } from './produto.routes.js';
import { artesaoRoutes } from './artesao.routes.js';
import { atelieRoutes } from './atelie.routes.js';
import { authRoutes } from './auth.routes.js';
import { PECAS_ROUTE_PATH, pecaRoutes } from './peca.routes.js';
import { atelieCadastroRoutes } from './atelieCadastro.routes.js';
import { estoqueRoutes } from './estoque.routes.js';
import { freteRoutes } from './frete.routes.js';
import { notificacaoRoutes } from './notificacao.routes.js';

export const routes = Router();

// Autenticação e sessão de usuários.
routes.use('/auth', authRoutes);

// Endpoint de saúde / health check
routes.use('/health', healthRoutes);

// Endpoints de catálogo e produtos
routes.use('/produtos', produtoRoutes);

// Endpoints de mestres e artesãos
routes.use('/artesaos', artesaoRoutes);

// Endpoints transacionais de estoque e reservas temporárias (HU-06)
routes.use('/estoque', estoqueRoutes);

// Simulação logística de frete e prazo por peça e CEP (HU-07)
routes.use('/frete', freteRoutes);

// Cadastro de peças no escopo do ateliê.
routes.use(PECAS_ROUTE_PATH, pecaRoutes);

// Cadastro de ateliê e endereço de expedição.
routes.use('/atelies', atelieCadastroRoutes);

// Endpoints de governança de ateliês, finanças protegidas e curadores.
routes.use('/atelies', atelieRoutes);

// Consulta auditada das próprias notificações transacionais do usuário autenticado (HU-17).
routes.use('/notificacoes', notificacaoRoutes);

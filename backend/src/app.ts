import express, { type Request } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { routes } from './routes/index.js';
import { PECAS_ROUTE_PATH, pecaJsonBodyParser } from './routes/peca.routes.js';
import { DIRETORIO_FOTOS_LOCAIS, resolverDriverFotos } from './config/fotosStorage.js';
import { ROTA_PUBLICA_FOTOS_LOCAIS } from './repositories/localDiskFotosPeca.storage.js';
import { AppError } from './utils/AppError.js';

export const app = express();

// Configuração flexível de CORS para desenvolvimento e produção
const allowedOrigins = [
  'http://localhost:5173', // Script npm run dev do Next.js
  'http://localhost:3000', // Execução nativa do Next.js
  env.CORS_ORIGIN,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (como mobile apps, Postman ou curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new AppError(`Origem não permitida por CORS: ${origin}`, 403));
      }
    },
    credentials: true,
  }),
);

// Corpo maior (fotos em base64) é aceito apenas na criação de peças; demais rotas mantêm o limite padrão.
app.use(`/api/v1${PECAS_ROUTE_PATH}`, pecaJsonBodyParser);
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as Request).rawBody = Buffer.from(buf);
    },
  }),
);
app.use(requestLogger);

// Fotos de peças no armazenamento local são somente leitura e não permitem listagem.
if (resolverDriverFotos() === 'local') {
  app.use(
    ROTA_PUBLICA_FOTOS_LOCAIS,
    express.static(DIRETORIO_FOTOS_LOCAIS, {
      index: false,
      dotfiles: 'deny',
      immutable: true,
      maxAge: '365d',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );
}

// Montagem das rotas da API sob o prefixo /api/v1 (compatível com frontend/src/services/api.ts)
app.use('/api/v1', routes);

// Middleware para rotas não encontradas (404)
app.use((req, res, next) => {
  next(new AppError(`Rota não encontrada: ${req.method} ${req.originalUrl}`, 404));
});

// Middleware global de tratamento de erros
app.use(errorHandler);

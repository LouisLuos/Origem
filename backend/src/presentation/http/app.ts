import cors from 'cors'
import express, { Express } from 'express'
import { asyncHandler } from './middlewares/asyncHandler'
import { errorHandler } from './middlewares/errorHandler'
import { createRequestLogger } from './middlewares/requestLogger'
import { ApiV1RouterDependencies, createApiV1Router } from './routes/apiV1Routes'

export interface CreateAppOptions extends ApiV1RouterDependencies {
  silentRequestLogs?: boolean
  checkDatabaseHealth?: () => Promise<boolean>
}

export function createApp(options: CreateAppOptions): Express {
  const app = express()

  app.disable('x-powered-by')
  app.use(cors({ origin: '*' }))
  app.use(express.json({ limit: '1mb' }))
  app.use(createRequestLogger(options.silentRequestLogs ?? false))

  const healthHandler = asyncHandler(async (_req, res) => {
    const dbHealthy = options.checkDatabaseHealth
      ? await options.checkDatabaseHealth().catch(() => false)
      : true

    res.status(dbHealthy ? 200 : 503).json({
      status: dbHealthy ? 'ok' : 'degraded',
      service: 'origem-backend',
      database: dbHealthy ? 'connected' : 'disconnected',
      worker: 'active',
      timestamp: new Date().toISOString(),
    })
  })

  app.get('/health', healthHandler)
  app.get('/api/v1/health', healthHandler)

  app.use('/api/v1', createApiV1Router(options))

  app.use((_req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada.' })
  })

  app.use(errorHandler)

  return app
}


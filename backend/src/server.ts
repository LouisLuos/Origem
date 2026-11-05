import 'dotenv/config'
import {
  NotificationWorkerService,
  OrderCheckoutService,
  StockReservationService,
} from './application'
import {
  prisma,
  PrismaArtisanRepository,
  PrismaNotificationRepository,
  PrismaOrderRepository,
  PrismaProductRepository,
  PrismaReviewRepository,
  PrismaUnitOfWork,
} from './infrastructure/database'
import { createApp } from './presentation/http'

export function bootstrapProductionApp() {
  const unitOfWork = new PrismaUnitOfWork(prisma)
  const productRepository = new PrismaProductRepository(prisma)
  const artisanRepository = new PrismaArtisanRepository(prisma)
  const orderRepository = new PrismaOrderRepository(prisma)
  const notificationRepository = new PrismaNotificationRepository(prisma)
  const reviewRepository = new PrismaReviewRepository(prisma)

  const notificationWorker = new NotificationWorkerService(notificationRepository, {
    retryIntervalMs: Number(process.env.NOTIFICATION_RETRY_MS ?? 300),
    simulatedSendDelayMs: Number(process.env.NOTIFICATION_SEND_DELAY_MS ?? 50),
  })

  const stockReservationService = new StockReservationService(
    unitOfWork,
    productRepository,
  )
  const orderCheckoutService = new OrderCheckoutService(
    unitOfWork,
    stockReservationService,
    notificationWorker,
  )

  const app = createApp({
    productRepository,
    artisanRepository,
    orderRepository,
    reviewRepository,
    stockReservationService,
    orderCheckoutService,
    checkDatabaseHealth: async () => {
      await prisma.$queryRaw`SELECT 1`
      return true
    },
  })

  return { app, notificationWorker }
}

if (require.main === module) {
  const preferredPort = Number.parseInt(process.env.PORT ?? '3000', 10) || 3000
  const { app, notificationWorker } = bootstrapProductionApp()

  notificationWorker.startRecoveryPolling()
  notificationWorker.drainPendingQueue().catch(() => {
    // Banco pode ainda não estar migrado no primeiro boot local; health check reportará o estado.
  })

  const startListening = (port: number, allowFallback: boolean) => {
    const server = app.listen(port, () => {
      console.info(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: `🏺 Origem Backend Express ativo em http://localhost:${port}/api/v1`,
          healthUrl: `http://localhost:${port}/health`,
        }),
      )
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && allowFallback) {
        const fallbackPort = 3001
        console.warn(
          `⚠️ Porta ${port} ocupada. Realizando fallback automático para a porta ${fallbackPort}...`,
        )
        startListening(fallbackPort, false)
        return
      }
      console.error('❌ Falha crítica ao iniciar servidor HTTP:', err)
      process.exit(1)
    })

    const shutdown = async (signal: string) => {
      console.info(`\n🛑 Recebido ${signal}. Encerrando Origem Backend de forma segura...`)
      notificationWorker.stopRecoveryPolling()
      server.close(async () => {
        await notificationWorker.waitForIdle()
        await prisma.$disconnect()
        process.exit(0)
      })
    }

    process.on('SIGINT', () => void shutdown('SIGINT'))
    process.on('SIGTERM', () => void shutdown('SIGTERM'))
  }

  startListening(preferredPort, preferredPort === 3000 && !process.env.PORT)
}


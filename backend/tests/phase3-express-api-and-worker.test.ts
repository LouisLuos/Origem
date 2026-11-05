import request from 'supertest'
import { describe, expect, it } from 'vitest'
import {
  Artisan,
  ArtisanQueryFilter,
  CreateArtisanData,
  CreateNotificationData,
  CreateOrderData,
  CreateProductData,
  createApp,
  DuplicateResourceException,
  IArtisanRepository,
  INotificationRepository,
  IOrderRepository,
  IProductRepository,
  IReviewRepository,
  IUnitOfWork,
  Notification,
  NotificationWorkerService,
  Order,
  OrderCheckoutService,
  PaginatedResult,
  Product,
  ProductNotFoundException,
  ProductQueryFilter,
  Review,
  StockReservationService,
  TransactionalRepositories,
  UpdateProductData,
} from '../src'
import { SEED_ARTISANS, SEED_PRODUCTS, SEED_REVIEWS } from '../prisma/seed'

/**
 * Repositório completo em memória com Lock Pessimista de tupla + persistência durável
 * de notificações para testes de integração HTTP ponta a ponta (Supertest + Express + Worker).
 */
class InMemoryFullBackendHarness implements IUnitOfWork {
  public readonly products = new Map<string, Product>()
  public readonly artisans = new Map<string, Artisan>()
  public readonly orders = new Map<string, Order>()
  public readonly notifications = new Map<string, Notification>()
  public readonly reviews: Review[] = []
  private readonly rowLocks = new Map<string, Promise<void>>()

  constructor() {
    for (const a of SEED_ARTISANS) {
      this.artisans.set(a.id, new Artisan(a))
    }
    for (const p of SEED_PRODUCTS) {
      this.products.set(p.id, new Product(p))
    }
    for (const r of SEED_REVIEWS) {
      this.reviews.push(new Review(r))
    }
  }

  private async lockRow(id: string): Promise<() => void> {
    const prev = this.rowLocks.get(id) ?? Promise.resolve()
    let release!: () => void
    const current = new Promise<void>((resolve) => {
      release = resolve
    })
    this.rowLocks.set(
      id,
      prev.then(() => current),
    )
    await prev
    return release
  }

  public readonly productRepository: IProductRepository = {
    findAll: async (filter: ProductQueryFilter = {}): Promise<PaginatedResult<Product>> => {
      let list = Array.from(this.products.values())
      if (filter.technique) {
        const tech = filter.technique.toLowerCase()
        list = list.filter((p) => p.technique.toLowerCase() === tech)
      }
      if (filter.hub) {
        const hub = filter.hub.toLowerCase()
        list = list.filter((p) => p.hub.toLowerCase().includes(hub))
      }
      if (filter.onlyActive !== undefined) {
        list = list.filter((p) => p.active === filter.onlyActive)
      }
      const page = Math.max(1, filter.page ?? 1)
      const limit = Math.max(1, filter.limit ?? 10)
      const start = (page - 1) * limit
      return {
        items: list.slice(start, start + limit),
        totalItems: list.length,
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(list.length / limit)),
      }
    },
    findById: async (id: string) => this.products.get(id) ?? null,
    findByIdForUpdate: async (id: string) => this.products.get(id) ?? null,
    create: async (data: CreateProductData) => {
      const entity = new Product(data)
      this.products.set(entity.id, entity)
      return entity
    },
    update: async (id: string, patch: UpdateProductData) => {
      const existing = this.products.get(id)
      if (!existing) throw new ProductNotFoundException(id)
      const updated = new Product({
        id: existing.id,
        title: patch.title ?? existing.title,
        artisanId: patch.artisanId !== undefined ? patch.artisanId : existing.artisanId,
        artisanName: patch.artisanName ?? existing.artisanName,
        hub: patch.hub ?? existing.hub,
        technique: patch.technique ?? existing.technique,
        price: patch.price ?? existing.price,
        compareAtPrice:
          patch.compareAtPrice !== undefined
            ? patch.compareAtPrice
            : existing.compareAtPrice,
        imageUrl: patch.imageUrl ?? existing.imageUrl,
        imageAlt: patch.imageAlt ?? existing.imageAlt,
        description:
          patch.description !== undefined ? patch.description : existing.description,
        details: patch.details ?? existing.details,
        ownerEmail: existing.ownerEmail,
        stock: patch.stock ?? existing.stock,
        active: patch.active ?? existing.active,
      })
      this.products.set(id, updated)
      return updated
    },
    decrementStock: async (id: string, quantity: number) => {
      const existing = this.products.get(id)
      if (!existing) throw new ProductNotFoundException(id)
      return this.productRepository.update(id, { stock: existing.stock - quantity })
    },
    delete: async (id: string) => {
      if (!this.products.has(id)) throw new ProductNotFoundException(id)
      this.products.delete(id)
    },
  }

  public readonly artisanRepository: IArtisanRepository = {
    findAll: async (filter: ArtisanQueryFilter = {}): Promise<PaginatedResult<Artisan>> => {
      let list = Array.from(this.artisans.values())
      if (filter.search) {
        const q = filter.search.toLowerCase()
        list = list.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.hub.toLowerCase().includes(q) ||
            a.technique.toLowerCase().includes(q),
        )
      }
      if (filter.hub) {
        const h = filter.hub.toLowerCase()
        list = list.filter((a) => a.hub.toLowerCase().includes(h))
      }
      if (filter.technique) {
        const t = filter.technique.toLowerCase()
        list = list.filter((a) => a.technique.toLowerCase().includes(t))
      }
      const page = Math.max(1, filter.page ?? 1)
      const limit = Math.max(1, filter.limit ?? 20)
      const start = (page - 1) * limit
      return {
        items: list.slice(start, start + limit),
        totalItems: list.length,
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(list.length / limit)),
      }
    },
    findById: async (id: string) => this.artisans.get(id) ?? null,
    findByEmail: async (email: string) => {
      const norm = email.trim().toLowerCase()
      return Array.from(this.artisans.values()).find((a) => a.email === norm) ?? null
    },
    create: async (data: CreateArtisanData) => {
      if (data.email) {
        const dup = await this.artisanRepository.findByEmail(data.email)
        if (dup) {
          throw new DuplicateResourceException('Já existe um artesão com este e-mail.')
        }
      }
      const created = new Artisan(data)
      this.artisans.set(created.id, created)
      return created
    },
  }

  public readonly orderRepository: IOrderRepository = {
    findAll: async (userEmail?: string) => {
      const list = Array.from(this.orders.values())
      if (!userEmail) return list
      const norm = userEmail.trim().toLowerCase()
      return list.filter((o) => o.userEmail === norm)
    },
    findById: async (id: string) => this.orders.get(id) ?? null,
    create: async (data: CreateOrderData) => {
      const order = new Order({ ...data, createdAt: data.createdAt ?? new Date() })
      this.orders.set(order.id, order)
      return order
    },
  }

  public readonly notificationRepository: INotificationRepository = {
    create: async (data: CreateNotificationData) => {
      const notif = new Notification({
        id: data.id ?? `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        orderId: data.orderId,
        recipientEmail: data.recipientEmail,
        type: data.type,
        payload: data.payload,
        status: data.status ?? 'pending',
        retryCount: 0,
        createdAt: new Date(),
      })
      this.notifications.set(notif.id, notif)
      return notif
    },
    findById: async (id: string) => this.notifications.get(id) ?? null,
    findByOrderId: async (orderId: string) =>
      Array.from(this.notifications.values()).filter((n) => n.orderId === orderId),
    findPending: async (limit = 50) =>
      Array.from(this.notifications.values())
        .filter((n) => n.status === 'pending')
        .slice(0, limit),
    recordAttemptFailure: async (id: string, retryCount: number, errorMessage: string) => {
      const curr = this.notifications.get(id)!
      const updated = new Notification({
        ...curr,
        retryCount,
        lastError: errorMessage,
      })
      this.notifications.set(id, updated)
      return updated
    },
    markSent: async (id: string, retryCount: number) => {
      const curr = this.notifications.get(id)!
      const updated = new Notification({
        ...curr,
        status: 'sent',
        retryCount,
        processedAt: new Date(),
      })
      this.notifications.set(id, updated)
      return updated
    },
    markFailed: async (id: string, retryCount: number, errorMessage: string) => {
      const curr = this.notifications.get(id)!
      const updated = new Notification({
        ...curr,
        status: 'failed',
        retryCount,
        lastError: errorMessage,
        processedAt: new Date(),
      })
      this.notifications.set(id, updated)
      return updated
    },
  }

  public readonly reviewRepository: IReviewRepository = {
    findAll: async () => [...this.reviews],
  }

  public async executeInTransaction<T>(
    work: (txRepos: TransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    const releases: Array<() => void> = []
    const lockedIds = new Set<string>()
    const stagedProducts = new Map<string, Product>()
    const stagedOrders: Order[] = []
    const stagedNotifications: Notification[] = []

    const getProd = (id: string) => stagedProducts.get(id) ?? this.products.get(id) ?? null

    const txProducts: IProductRepository = {
      ...this.productRepository,
      findById: async (id: string) => getProd(id),
      findByIdForUpdate: async (id: string) => {
        if (!lockedIds.has(id)) {
          releases.push(await this.lockRow(id))
          lockedIds.add(id)
        }
        return getProd(id)
      },
      decrementStock: async (id: string, quantity: number) => {
        const curr = getProd(id)
        if (!curr) throw new ProductNotFoundException(id)
        const updated = new Product({
          id: curr.id,
          title: curr.title,
          artisanId: curr.artisanId,
          artisanName: curr.artisanName,
          hub: curr.hub,
          technique: curr.technique,
          price: curr.price,
          compareAtPrice: curr.compareAtPrice,
          imageUrl: curr.imageUrl,
          imageAlt: curr.imageAlt,
          description: curr.description,
          details: curr.details,
          ownerEmail: curr.ownerEmail,
          stock: curr.stock - quantity,
          active: curr.active,
        })
        stagedProducts.set(id, updated)
        return updated
      },
    }

    const txOrders: IOrderRepository = {
      ...this.orderRepository,
      create: async (data: CreateOrderData) => {
        const ord = new Order({ ...data, createdAt: data.createdAt ?? new Date() })
        stagedOrders.push(ord)
        return ord
      },
    }

    const txNotifs: INotificationRepository = {
      ...this.notificationRepository,
      create: async (data: CreateNotificationData) => {
        const notif = new Notification({
          id: data.id ?? `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          orderId: data.orderId,
          recipientEmail: data.recipientEmail,
          type: data.type,
          payload: data.payload,
          status: data.status ?? 'pending',
          retryCount: 0,
          createdAt: new Date(),
        })
        stagedNotifications.push(notif)
        return notif
      },
    }

    try {
      const result = await work({
        products: txProducts,
        orders: txOrders,
        notifications: txNotifs,
      })

      for (const [id, prod] of stagedProducts.entries()) this.products.set(id, prod)
      for (const ord of stagedOrders) this.orders.set(ord.id, ord)
      for (const notif of stagedNotifications) this.notifications.set(notif.id, notif)

      return result
    } finally {
      for (const rel of releases.reverse()) rel()
    }
  }
}

function buildTestEnvironment(workerDelayMs = 30, retryIntervalMs = 20) {
  const harness = new InMemoryFullBackendHarness()
  const worker = new NotificationWorkerService(harness.notificationRepository, {
    simulatedSendDelayMs: workerDelayMs,
    retryIntervalMs,
    silentLogs: true,
  })
  const stockService = new StockReservationService(harness, harness.productRepository)
  const checkoutService = new OrderCheckoutService(harness, stockService, worker)

  const app = createApp({
    productRepository: harness.productRepository,
    artisanRepository: harness.artisanRepository,
    orderRepository: harness.orderRepository,
    reviewRepository: harness.reviewRepository,
    stockReservationService: stockService,
    orderCheckoutService: checkoutService,
    silentRequestLogs: true,
  })

  return { app, harness, worker }
}

describe('Fase 3 & 4 — Servidor Express, Rotas REST /api/v1 & Worker Assíncrono', () => {
  it('GET /health e fallback 404 funcionam conforme RNF-09 e contratos-api.md', async () => {
    const { app } = buildTestEnvironment()

    const healthRes = await request(app).get('/health')
    expect(healthRes.status).toBe(200)
    expect(healthRes.body.status).toBe('ok')
    expect(healthRes.body.database).toBe('connected')

    const missingRes = await request(app).get('/api/v1/rota-inexistente')
    expect(missingRes.status).toBe(404)
    expect(missingRes.body).toEqual({ erro: 'Rota não encontrada.' })
  })

  it('CRUD completo de Produtos (/api/v1/produtos) e Reserva de Estoque (/api/v1/estoque/reservas)', async () => {
    const { app } = buildTestEnvironment()

    // 1. GET paginado + filtro por técnica
    const listRes = await request(app).get(
      '/api/v1/produtos?technique=Xilogravura&limit=50',
    )
    expect(listRes.status).toBe(200)
    expect(listRes.body.dados.length).toBeGreaterThanOrEqual(2)
    expect(listRes.body.meta).toHaveProperty('totalItens')
    for (const item of listRes.body.dados) {
      expect(item.technique).toBe('Xilogravura')
    }

    // 2. GET detalhe por ID existente e 404 inexistente
    const detailRes = await request(app).get('/api/v1/produtos/api-101')
    expect(detailRes.status).toBe(200)
    expect(detailRes.body.title).toBe('Trio de Forrozeiros em Barro')

    const notFoundRes = await request(app).get('/api/v1/produtos/nao-existe')
    expect(notFoundRes.status).toBe(404)
    expect(notFoundRes.body).toEqual({ erro: 'Produto não encontrado.' })

    // 3. POST validação 400 e criação 201
    const badCreateRes = await request(app)
      .post('/api/v1/produtos')
      .send({ title: 'Incompleto' })
    expect(badCreateRes.status).toBe(400)
    expect(badCreateRes.body.erro).toContain('Campo obrigatório:')

    const createRes = await request(app).post('/api/v1/produtos').send({
      title: 'Moringa de Barro Gravada',
      artisan: 'Zé Caboclo',
      hub: 'Alto do Moura',
      technique: 'Cerâmica Figurativa',
      price: 135,
      imageUrl: 'https://picsum.photos/seed/moringa/800/800',
      imageAlt: 'Moringa artesanal de barro fresco com desenhos incisos',
      ownerEmail: 'artesao@origem.com',
      stock: 4,
    })
    expect(createRes.status).toBe(201)
    const newId = createRes.body.id as string
    expect(newId).toMatch(/^api-/)

    // 4. PATCH estoque e status
    const patchRes = await request(app)
      .patch(`/api/v1/produtos/${newId}`)
      .send({ stock: 10, price: 140 })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.stock).toBe(10)
    expect(patchRes.body.price).toBe(140)

    // 5. POST /api/v1/estoque/reservas (200 sucesso + 409 conflito tudo-ou-nada)
    const reserveOk = await request(app)
      .post('/api/v1/estoque/reservas')
      .send({ lines: [{ productId: newId, quantity: 3 }] })
    expect(reserveOk.status).toBe(200)
    const updatedInList = reserveOk.body.dados.find((p: { id: string }) => p.id === newId)
    expect(updatedInList.stock).toBe(7)

    const reserveConflict = await request(app)
      .post('/api/v1/estoque/reservas')
      .send({ lines: [{ productId: newId, quantity: 99 }] })
    expect(reserveConflict.status).toBe(409)
    expect(reserveConflict.body).toEqual({
      erro: 'Estoque insuficiente para Moringa de Barro Gravada.',
    })

    // 6. DELETE 204
    const deleteRes = await request(app).delete(`/api/v1/produtos/${newId}`)
    expect(deleteRes.status).toBe(204)
  })

  it('Rotas de Artesãos (/api/v1/artesaos) e Avaliações (/api/v1/avaliacoes) respeitam LGPD e filtros', async () => {
    const { app } = buildTestEnvironment()

    const artisansRes = await request(app).get('/api/v1/artesaos?q=Caruaru')
    expect(artisansRes.status).toBe(200)
    expect(artisansRes.body.dados.length).toBeGreaterThanOrEqual(1)
    // Salvaguarda LGPD: Zé Caboclo tem workshopAddress interno mas publicContactConsent = false
    const zeCaboclo = artisansRes.body.dados.find((a: { id: string }) => a.id === 'a-01')
    expect(zeCaboclo).toBeDefined()
    expect(zeCaboclo.publicWorkshopAddress).toBeUndefined()
    expect(zeCaboclo.publicEmail).toBeUndefined()

    // Cadastro duplicado retorna 409
    const dupRes = await request(app).post('/api/v1/artesaos').send({
      name: 'Outro Zé',
      hub: 'Caruaru',
      technique: 'Cerâmica Figurativa',
      bio: 'Bio.',
      since: 2010,
      photoUrl: 'https://picsum.photos/seed/p/600/700',
      photoAlt: 'Foto de perfil do artesão',
      coverUrl: 'https://picsum.photos/seed/c/1600/500',
      coverAlt: 'Foto de capa do ateliê',
      email: 'artesao@origem.com',
    })
    expect(dupRes.status).toBe(409)

    const reviewsRes = await request(app).get('/api/v1/avaliacoes')
    expect(reviewsRes.status).toBe(200)
    expect(reviewsRes.body.dados).toHaveLength(3)
  })

  it('Checkout Concorrente HTTP + Worker Assíncrono (POST /api/v1/pedidos): responde 201 como pending imediatamente e processa fila para sent / failed com 3 retries', async () => {
    // api-103 (Leão Cacheado) tem estoque inicial = 3 no seed!
    const { app, harness, worker } = buildTestEnvironment(60, 20)

    // Dispara 10 requisições HTTP simultâneas disputando as 3 unidades de api-103
    const concurrentCheckouts = Array.from({ length: 10 }, (_, idx) =>
      request(app)
        .post('/api/v1/pedidos')
        .send({
          userEmail: `comprador${idx}@origem.com`,
          customer: {
            name: `Comprador ${idx}`,
            email: `comprador${idx}@origem.com`,
            phone: '81999998888',
            zip: '50030-000',
            street: 'Praça do Arsenal',
            number: '10',
            complement: '',
            neighborhood: 'Recife Antigo',
            city: 'Recife',
            state: 'PE',
          },
          paymentMethod: 'pix',
          lines: [{ productId: 'api-103', quantity: 1 }],
        }),
    )

    const httpResponses = await Promise.all(concurrentCheckouts)
    const approvedResponses = httpResponses.filter((r) => r.status === 201)
    const conflictResponses = httpResponses.filter((r) => r.status === 409)

    expect(approvedResponses).toHaveLength(3)
    expect(conflictResponses).toHaveLength(7)

    // Comprova desacoplamento HTTP: no momento da resposta 201, as notificações nasceram como 'pending'
    for (const okRes of approvedResponses) {
      expect(okRes.body.notificacoes[0].status).toBe('pending')
    }

    // Estoque final exatamente 0 (zero overselling)
    expect(harness.products.get('api-103')?.stock).toBe(0)

    // Aguarda o Worker em background drenar todas as tarefas e confirma transição para 'sent'
    await worker.waitForIdle()
    const processedNotifications = Array.from(harness.notifications.values())
    expect(processedNotifications).toHaveLength(3)
    for (const notif of processedNotifications) {
      expect(notif.status).toBe('sent')
      expect(notif.retryCount).toBe(1)
      expect(notif.processedAt).not.toBeNull()
    }

    // Cenário de falha determinística: verifica 3 retentativas fixas antes de marcar como 'failed'
    const failOrderRes = await request(app)
      .post('/api/v1/pedidos')
      .send({
        orderId: 'OR-SIMULATE-FAILURE-99',
        customerName: 'Teste Resiliência DLQ',
        customerEmail: 'resiliencia@origem.com',
        shippingAddress: {
          phone: '81977776666',
          zip: '53000-000',
          street: 'Ladeira da Misericórdia',
          number: '12',
          complement: '',
          neighborhood: 'Carmo',
          city: 'Olinda',
          state: 'PE',
        },
        paymentMethod: 'boleto',
        lines: [{ productId: 'api-101', quantity: 1 }],
      })

    expect(failOrderRes.status).toBe(201)
    const failNotifId = failOrderRes.body.notificacoes[0].id as string
    expect(failOrderRes.body.notificacoes[0].status).toBe('pending')

    await worker.waitForIdle()

    const failedNotif = harness.notifications.get(failNotifId)
    expect(failedNotif).toBeDefined()
    expect(failedNotif?.status).toBe('failed')
    expect(failedNotif?.retryCount).toBe(3)
    expect(failedNotif?.lastError).toContain('Falha simulada')

    // Listagem de pedidos via GET /api/v1/pedidos
    const ordersListRes = await request(app).get('/api/v1/pedidos')
    expect(ordersListRes.status).toBe(200)
    expect(ordersListRes.body.dados).toHaveLength(4)
  })
})


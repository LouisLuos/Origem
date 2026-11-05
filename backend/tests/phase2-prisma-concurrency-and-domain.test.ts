import fs from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  Artisan,
  CreateNotificationData,
  CreateOrderData,
  CreateProductData,
  INotificationRepository,
  InsufficientStockException,
  IOrderRepository,
  IProductRepository,
  IUnitOfWork,
  Notification,
  Order,
  OrderCheckoutService,
  PaginatedResult,
  PrismaProductRepository,
  Product,
  ProductQueryFilter,
  ProductUnavailableException,
  reserveStockWithPessimisticLock,
  StockReservationService,
  TransactionalRepositories,
  UpdateProductData,
} from '../src'
import {
  buildSeedUsers,
  SEED_ARTISANS,
  SEED_PRODUCTS,
  SEED_REVIEWS,
} from '../prisma/seed'

/**
 * Harness transacional em memória que simula fielmente o gerenciador de locks de tupla
 * do PostgreSQL (`SELECT ... FOR UPDATE` + `COMMIT` / `ROLLBACK` ACID) para testes determinísticos
 * de alta concorrência (100 requisições simultâneas) e atomicidade multi-item.
 */
class PostgresPessimisticLockHarness implements IUnitOfWork {
  private readonly productsStore = new Map<string, Product>()
  private readonly ordersStore = new Map<string, Order>()
  private readonly notificationsStore = new Map<string, Notification>()
  private readonly rowLockChains = new Map<string, Promise<void>>()
  public readonly lockAcquisitionLog: string[] = []

  constructor(initialProducts: Product[]) {
    for (const p of initialProducts) {
      this.productsStore.set(p.id, p)
    }
  }

  public getProduct(id: string): Product | undefined {
    return this.productsStore.get(id)
  }

  public getOrders(): Order[] {
    return Array.from(this.ordersStore.values())
  }

  public getNotifications(): Notification[] {
    return Array.from(this.notificationsStore.values())
  }

  private async acquireRowLock(productId: string): Promise<() => void> {
    const previous = this.rowLockChains.get(productId) ?? Promise.resolve()
    let releaseCurrent!: () => void
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve
    })
    const chained = previous.then(() => current)
    this.rowLockChains.set(productId, chained)
    await previous
    return releaseCurrent
  }

  public getReadOnlyProductRepo(): IProductRepository {
    return {
      findAll: async (filter?: ProductQueryFilter): Promise<PaginatedResult<Product>> => {
        const items = Array.from(this.productsStore.values())
        const limit = filter?.limit ?? 100
        return {
          items: items.slice(0, limit),
          totalItems: items.length,
          currentPage: 1,
          totalPages: 1,
        }
      },
      findById: async (id: string) => this.productsStore.get(id) ?? null,
      findByIdForUpdate: async () => {
        throw new Error('findByIdForUpdate deve ser chamado dentro de uma transação.')
      },
      create: async (data: CreateProductData) => new Product(data),
      update: async (_id: string, _patch: UpdateProductData) => {
        throw new Error('Não utilizado neste harness.')
      },
      decrementStock: async () => {
        throw new Error('decrementStock deve ser chamado dentro de uma transação.')
      },
      delete: async () => {},
    }
  }

  public async executeInTransaction<T>(
    work: (txRepos: TransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    const heldReleases: Array<() => void> = []
    const lockedIdsInTx = new Set<string>()
    const stagedProducts = new Map<string, Product>()
    const stagedOrders: Order[] = []
    const stagedNotifications: Notification[] = []

    const getEffectiveProduct = (id: string): Product | null => {
      return stagedProducts.get(id) ?? this.productsStore.get(id) ?? null
    }

    const txProducts: IProductRepository = {
      findAll: async () => ({
        items: Array.from(this.productsStore.values()),
        totalItems: this.productsStore.size,
        currentPage: 1,
        totalPages: 1,
      }),
      findById: async (id: string) => getEffectiveProduct(id),
      findByIdForUpdate: async (id: string) => {
        if (!lockedIdsInTx.has(id)) {
          const release = await this.acquireRowLock(id)
          heldReleases.push(release)
          lockedIdsInTx.add(id)
          this.lockAcquisitionLog.push(id)
        }
        // Simula micro-latência de I/O de rede entre lock e update para expor race conditions caso não houvesse lock
        await new Promise((r) => setTimeout(r, 1))
        return getEffectiveProduct(id)
      },
      create: async (data: CreateProductData) => {
        const created = new Product(data)
        stagedProducts.set(created.id, created)
        return created
      },
      update: async (id: string, patch: UpdateProductData) => {
        const current = getEffectiveProduct(id)
        if (!current) throw new Error('Produto não encontrado')
        const updated = new Product({
          ...current,
          ...patch,
          details: patch.details ?? current.details,
        })
        stagedProducts.set(id, updated)
        return updated
      },
      decrementStock: async (id: string, quantity: number) => {
        const current = getEffectiveProduct(id)
        if (!current) throw new Error('Produto não encontrado')
        const updated = new Product({
          id: current.id,
          title: current.title,
          artisanId: current.artisanId,
          artisanName: current.artisanName,
          hub: current.hub,
          technique: current.technique,
          price: current.price,
          compareAtPrice: current.compareAtPrice,
          imageUrl: current.imageUrl,
          imageAlt: current.imageAlt,
          description: current.description,
          details: current.details,
          ownerEmail: current.ownerEmail,
          stock: current.stock - quantity,
          active: current.active,
        })
        stagedProducts.set(id, updated)
        return updated
      },
      delete: async (id: string) => {
        stagedProducts.delete(id)
      },
    }

    const txOrders: IOrderRepository = {
      findAll: async () => Array.from(this.ordersStore.values()),
      findById: async (id: string) => this.ordersStore.get(id) ?? null,
      create: async (data: CreateOrderData) => {
        const order = new Order({
          ...data,
          createdAt: data.createdAt ?? new Date(),
        })
        stagedOrders.push(order)
        return order
      },
    }

    const txNotifications: INotificationRepository = {
      create: async (data: CreateNotificationData) => {
        const notif = new Notification({
          id: data.id ?? `notif-${Math.random().toString(36).slice(2, 10)}`,
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
      findById: async () => null,
      findByOrderId: async () => [],
      findPending: async () => [],
      recordAttemptFailure: async () => {
        throw new Error('Não utilizado no checkout')
      },
      markSent: async () => {
        throw new Error('Não utilizado no checkout')
      },
      markFailed: async () => {
        throw new Error('Não utilizado no checkout')
      },
    }

    try {
      const result = await work({
        products: txProducts,
        orders: txOrders,
        notifications: txNotifications,
      })

      // COMMIT atômico: aplica todas as mutações estagiadas
      for (const [id, prod] of stagedProducts.entries()) {
        this.productsStore.set(id, prod)
      }
      for (const ord of stagedOrders) {
        this.ordersStore.set(ord.id, ord)
      }
      for (const notif of stagedNotifications) {
        this.notificationsStore.set(notif.id, notif)
      }

      return result
    } finally {
      // Libera todos os locks XMAX adquiridos (em caso de COMMIT ou ROLLBACK)
      for (const release of heldReleases.reverse()) {
        release()
      }
    }
  }
}

describe('Fase 2 — Prisma ORM, Clean Architecture, Lock Pessimista & LGPD', () => {
  it('RNF-04 (Clean Architecture): Camada de Domínio não possui imports de Prisma, Express, Zod ou Dotenv', () => {
    const domainDir = path.resolve(__dirname, '../src/domain')
    const collectTsFiles = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      return entries.flatMap((entry) => {
        const fullPath = path.join(dir, entry.name)
        return entry.isDirectory() ? collectTsFiles(fullPath) : fullPath.endsWith('.ts') ? [fullPath] : []
      })
    }

    const domainFiles = collectTsFiles(domainDir)
    expect(domainFiles.length).toBeGreaterThan(0)

    for (const file of domainFiles) {
      const source = fs.readFileSync(file, 'utf-8')
      expect(source).not.toMatch(/from\s+['"]@prisma\/client['"]/)
      expect(source).not.toMatch(/from\s+['"]express['"]/)
      expect(source).not.toMatch(/from\s+['"]zod['"]/)
      expect(source).not.toMatch(/from\s+['"]dotenv/)
    }
  })

  it('RNF-01 (Lock Pessimista SQL): PrismaProductRepository emite SELECT ... FROM "product" WHERE "id" = $1 FOR UPDATE e decrementa atomicamente', async () => {
    const queryRawSpy = vi.fn().mockResolvedValue([
      {
        id: 'api-103',
        title: 'Leão Cacheado',
        artisanId: 'a-05',
        artisanName: 'Mestre Nuca (Oficina)',
        hub: 'Tracunhaém',
        technique: 'Escultura',
        price: new Prisma.Decimal('350.00'),
        compareAtPrice: null,
        imageUrl: 'https://picsum.photos/seed/api-103/800/800',
        imageAlt: 'Escultura artesanal de leão em barro',
        description: 'Escultura de barro inspirada na tradição de Tracunhaém.',
        details: ['Modelagem manual', 'Peça única'],
        ownerEmail: 'mestre-nuca@artesaos.origem.com',
        stock: 3,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])

    const updateSpy = vi.fn().mockResolvedValue({
      id: 'api-103',
      title: 'Leão Cacheado',
      artisanId: 'a-05',
      artisanName: 'Mestre Nuca (Oficina)',
      hub: 'Tracunhaém',
      technique: 'Escultura',
      price: new Prisma.Decimal('350.00'),
      compareAtPrice: null,
      imageUrl: 'https://picsum.photos/seed/api-103/800/800',
      imageAlt: 'Escultura artesanal de leão em barro',
      description: 'Escultura de barro inspirada na tradição de Tracunhaém.',
      details: ['Modelagem manual', 'Peça única'],
      ownerEmail: 'mestre-nuca@artesaos.origem.com',
      stock: 1,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const fakeTx = {
      $queryRaw: queryRawSpy,
      product: { update: updateSpy },
    } as unknown as Prisma.TransactionClient

    const updated = await reserveStockWithPessimisticLock(fakeTx, 'api-103', 2)

    expect(queryRawSpy).toHaveBeenCalledTimes(1)
    const templateStrings = queryRawSpy.mock.calls[0][0] as TemplateStringsArray
    const boundProductId = queryRawSpy.mock.calls[0][1]
    const rawSql = templateStrings.join('$1')

    expect(rawSql).toContain('FROM "product"')
    expect(rawSql).toContain('WHERE "id" = $1')
    expect(rawSql).toContain('FOR UPDATE')
    expect(boundProductId).toBe('api-103')

    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'api-103' },
      data: { stock: { decrement: 2 } },
    })
    expect(updated.stock).toBe(1)
  })

  it('RNF-01 (Concorrência Crítica — 100 requisições simultâneas sobre 1 unidade): aprova exatamente 1 compra e rejeita 99 com InsufficientStockException', async () => {
    const uniquePiece = new Product({
      id: 'peca-unica-alto-do-moura',
      title: 'Noivos em Barro — Peça Única Assinada',
      artisanId: 'a-01',
      artisanName: 'Zé Caboclo',
      hub: 'Alto do Moura',
      technique: 'Cerâmica Figurativa',
      price: 420,
      imageUrl: 'https://picsum.photos/seed/unica/800/800',
      imageAlt: 'Escultura única de casal de noivos em barro do Alto do Moura',
      details: ['Peça exclusiva 1/1'],
      ownerEmail: 'artesao@origem.com',
      stock: 1,
      active: true,
    })

    const harness = new PostgresPessimisticLockHarness([uniquePiece])
    const stockService = new StockReservationService(harness, harness.getReadOnlyProductRepo())
    const checkoutService = new OrderCheckoutService(harness, stockService)

    const concurrentBuyers = Array.from({ length: 100 }, (_, idx) =>
      checkoutService.checkout({
        customerName: `Comprador Concorrente ${idx + 1}`,
        customerEmail: `comprador${idx + 1}@teste.com`,
        shippingAddress: {
          phone: '81999990000',
          zip: '50000-000',
          street: 'Rua do Bom Jesus',
          number: '100',
          complement: '',
          neighborhood: 'Recife Antigo',
          city: 'Recife',
          state: 'PE',
        },
        paymentMethod: 'pix',
        lines: [{ productId: 'peca-unica-alto-do-moura', quantity: 1 }],
      }),
    )

    const outcomes = await Promise.allSettled(concurrentBuyers)
    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled')
    const rejected = outcomes.filter(
      (o): o is PromiseRejectedResult => o.status === 'rejected',
    )

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(99)
    for (const rej of rejected) {
      expect(rej.reason).toBeInstanceOf(InsufficientStockException)
    }

    expect(harness.getProduct('peca-unica-alto-do-moura')?.stock).toBe(0)
    expect(harness.getOrders()).toHaveLength(1)
    expect(harness.getNotifications()).toHaveLength(1)
    expect(harness.getNotifications()[0].status).toBe('pending')
  })

  it('RNF-01 + RNF-05 (Cenário Rubrica FCCPD — 10 threads para estoque = 3): 3 vendas, 7 rejeições, estoque 0 e 3 notificações pending sem bloquear checkout', async () => {
    const fccpdItem = new Product({
      id: 'poc-test-reliability-item',
      title: 'Leão Cacheado de Tracunhaém',
      artisanId: 'a-05',
      artisanName: 'Mestre Nuca (Oficina)',
      hub: 'Tracunhaém',
      technique: 'Escultura',
      price: 350,
      imageUrl: 'https://picsum.photos/seed/api-103/800/800',
      imageAlt: 'Escultura artesanal de leão cacheado em barro',
      details: ['Peça numerada'],
      ownerEmail: 'mestre-nuca@artesaos.origem.com',
      stock: 3,
      active: true,
    })

    const dispatchedIds: string[] = []
    const nonBlockingDispatcher = {
      dispatchAsync: vi.fn((ids: string[]) => {
        dispatchedIds.push(...ids)
      }),
    }

    const harness = new PostgresPessimisticLockHarness([fccpdItem])
    const stockService = new StockReservationService(harness, harness.getReadOnlyProductRepo())
    const checkoutService = new OrderCheckoutService(
      harness,
      stockService,
      nonBlockingDispatcher,
    )

    const tasks = Array.from({ length: 10 }, (_, idx) =>
      checkoutService.checkout({
        customerName: `Cliente ${idx + 1}`,
        customerEmail: `cliente${idx + 1}@origem.com`,
        shippingAddress: {
          phone: '81988887777',
          zip: '55000-000',
          street: 'Av. Agamenon Magalhães',
          number: '50',
          complement: 'Apto 201',
          neighborhood: 'Maurício de Nassau',
          city: 'Caruaru',
          state: 'PE',
        },
        paymentMethod: 'card',
        lines: [{ productId: 'poc-test-reliability-item', quantity: 1 }],
      }),
    )

    const results = await Promise.allSettled(tasks)
    const successes = results.filter((r) => r.status === 'fulfilled')
    const failures = results.filter((r) => r.status === 'rejected')

    expect(successes).toHaveLength(3)
    expect(failures).toHaveLength(7)
    expect(harness.getProduct('poc-test-reliability-item')?.stock).toBe(0)
    expect(harness.getNotifications()).toHaveLength(3)
    expect(dispatchedIds).toHaveLength(3)
    expect(nonBlockingDispatcher.dispatchAsync).toHaveBeenCalledTimes(3)
  })

  it('Atomicidade Tudo-ou-Nada & Prevenção de Deadlock: ordena locks por ID e faz rollback integral se o segundo item não tiver estoque', async () => {
    const itemA = new Product({
      id: 'api-101',
      title: 'Trio de Forrozeiros em Barro',
      artisanName: 'Associação Alto do Moura',
      hub: 'Alto do Moura',
      technique: 'Cerâmica Figurativa',
      price: 120,
      imageUrl: 'https://picsum.photos/seed/api-101/800/800',
      imageAlt: 'Trio de forrozeiros modelados em barro',
      details: [],
      ownerEmail: 'alto-do-moura@artesaos.origem.com',
      stock: 5,
      active: true,
    })

    const itemB = new Product({
      id: 'api-102',
      title: 'Vaso Rústico',
      artisanName: 'Associação Alto do Moura',
      hub: 'Alto do Moura',
      technique: 'Cerâmica Figurativa',
      price: 85,
      imageUrl: 'https://picsum.photos/seed/api-102/800/800',
      imageAlt: 'Vaso rústico de cerâmica',
      details: [],
      ownerEmail: 'alto-do-moura@artesaos.origem.com',
      stock: 1,
      active: true,
    })

    const harness = new PostgresPessimisticLockHarness([itemA, itemB])
    const stockService = new StockReservationService(harness, harness.getReadOnlyProductRepo())

    // Carrinho envia [api-102, api-101] fora de ordem, pedindo 2 unidades de api-102 (estoque = 1)
    await expect(
      stockService.reserveStock([
        { productId: 'api-102', quantity: 2 },
        { productId: 'api-101', quantity: 3 },
      ]),
    ).rejects.toThrow(InsufficientStockException)

    // Verifica que os locks foram adquiridos em ordem canônica (api-101 antes de api-102)
    expect(harness.lockAcquisitionLog).toEqual(['api-101', 'api-102'])

    // Verifica ROLLBACK ACID integral: api-101 NÃO perdeu as 3 unidades!
    expect(harness.getProduct('api-101')?.stock).toBe(5)
    expect(harness.getProduct('api-102')?.stock).toBe(1)

    // Verifica rejeição de peça pausada (active = false) com ProductUnavailableException
    const pausedItem = new Product({ ...itemA, id: 'api-paused', active: false })
    const harnessPaused = new PostgresPessimisticLockHarness([pausedItem])
    const pausedService = new StockReservationService(
      harnessPaused,
      harnessPaused.getReadOnlyProductRepo(),
    )
    await expect(
      pausedService.reserveStock([{ productId: 'api-paused', quantity: 1 }]),
    ).rejects.toThrow(ProductUnavailableException)

    // Verifica que PrismaProductRepository também propaga corretamente ausência de linha
    const emptyRepo = new PrismaProductRepository({
      $queryRaw: vi.fn().mockResolvedValue([]),
    } as unknown as Prisma.TransactionClient)
    expect(await emptyRepo.findByIdForUpdate('inexistente')).toBeNull()
  })

  it('LGPD, Acessibilidade WCAG 2.1 AA e Integridade do Seed: oculta contatos sem consentimento, usa bcrypt e valida todo o acervo', async () => {
    const artisanWithoutConsent = new Artisan({
      id: 'a-lgpd-1',
      name: 'Mestre Vitalino Neto',
      hub: 'Alto do Moura',
      technique: 'Cerâmica Figurativa',
      bio: 'Ceramista tradicional.',
      since: 1998,
      photoUrl: 'https://picsum.photos/seed/1/600/700',
      photoAlt: 'Retrato do mestre ceramista em seu ateliê',
      coverUrl: 'https://picsum.photos/seed/2/1600/500',
      coverAlt: 'Bancada de barro no Alto do Moura',
      email: 'privado@artesao.com',
      phone: '81999991111',
      workshopAddress: 'Rua Secreta, 42, Caruaru',
      publicContactConsent: false,
    })

    const publicDtoHidden = artisanWithoutConsent.toPublicProfileDto()
    expect(publicDtoHidden.publicEmail).toBeUndefined()
    expect(publicDtoHidden.publicPhone).toBeUndefined()
    expect(publicDtoHidden.publicWorkshopAddress).toBeUndefined()

    const artisanWithConsent = new Artisan({
      ...artisanWithoutConsent,
      publicContactConsent: true,
    })
    const publicDtoVisible = artisanWithConsent.toPublicProfileDto()
    expect(publicDtoVisible.publicEmail).toBe('privado@artesao.com')
    expect(publicDtoVisible.publicWorkshopAddress).toBe('Rua Secreta, 42, Caruaru')

    // Valida senhas com hash bcrypt no seed
    const seedUsers = await buildSeedUsers('origem123')
    expect(seedUsers.length).toBeGreaterThanOrEqual(3)
    for (const u of seedUsers) {
      expect(u.passwordHash).not.toBe('origem123')
      expect(u.passwordHash).toMatch(/^\$2[aby]\$10\$/)
      expect(await bcrypt.compare('origem123', u.passwordHash)).toBe(true)
    }

    // Valida integridade relacional e acessibilidade (WCAG alt) de todo o Seed
    const artisanIds = new Set(SEED_ARTISANS.map((a) => a.id))
    expect(artisanIds.has('a-01')).toBe(true)
    expect(artisanIds.has('a-07')).toBe(true)

    for (const artisan of SEED_ARTISANS) {
      expect(() => new Artisan(artisan)).not.toThrow()
    }

    const productIds = new Set(SEED_PRODUCTS.map((p) => p.id))
    expect(productIds.has('api-101')).toBe(true)
    expect(productIds.has('api-102')).toBe(true)
    expect(productIds.has('api-103')).toBe(true)

    for (const prod of SEED_PRODUCTS) {
      if (prod.artisanId) {
        expect(artisanIds.has(prod.artisanId)).toBe(true)
      }
      const entity = new Product(prod)
      expect(entity.toCatalogDto().artisan).toBe(prod.artisanName)
    }

    expect(SEED_REVIEWS).toHaveLength(3)
  })
})


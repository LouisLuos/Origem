import { allProducts } from '@/data/mockProducts'
import type { Product } from '@/design-system/components/ProductCard'
import { DEMO_ARTISAN } from './authService'
import { readStorage, simulateLatency, writeStorage } from './storage'

export interface CatalogItem extends Product {
  /** E-mail da conta de artesão dona da peça. */
  ownerEmail: string
  stock: number
  /** Peças pausadas ficam fora da vitrine pública. */
  active: boolean
}

export type CatalogItemInput = Omit<CatalogItem, 'id' | 'ownerEmail' | 'artisan'>

export interface Owner {
  email: string
  name: string
}

export interface StockReservation {
  productId: string
  quantity: number
}

// v2: o catálogo passou a ser a fonte única da vitrine (formato incompatível com o painel antigo).
const CATALOG_KEY = 'origem:catalog:v2'
const SEED_STOCK = [8, 5, 12, 3, 9, 6, 4, 15, 7, 10]

const slug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

/** Catálogo inicial: os produtos do mock, cada um com estoque e um dono (o Zé Caboclo é a conta demo). */
function seedCatalog(): CatalogItem[] {
  return allProducts.map((product, index) => ({
    ...product,
    ownerEmail: product.artisan === DEMO_ARTISAN.name ? DEMO_ARTISAN.email : `${slug(product.artisan)}@artesaos.origem.com`,
    stock: SEED_STOCK[index % SEED_STOCK.length],
    active: true,
  }))
}

function load(): CatalogItem[] {
  return readStorage<CatalogItem[] | null>(CATALOG_KEY, null) ?? seedCatalog()
}

function save(items: CatalogItem[]) {
  writeStorage(CATALOG_KEY, items)
}

/**
 * Catálogo e estoque. Equivalente a `GET/POST /produtos`, `PATCH/DELETE /produtos/:id`
 * e `POST /estoque/reservas`. É a fonte única da vitrine, dos painéis do artesão e da administração.
 */
export const catalogService = {
  async list(): Promise<CatalogItem[]> {
    await simulateLatency(400)
    return load()
  },

  async create(owner: Owner, input: CatalogItemInput): Promise<CatalogItem> {
    await simulateLatency(200)
    const item: CatalogItem = { ...input, id: `c-${Date.now().toString(36)}`, ownerEmail: owner.email, artisan: owner.name }
    save([item, ...load()])
    return item
  },

  async update(id: string, patch: Partial<CatalogItemInput>): Promise<CatalogItem> {
    await simulateLatency(200)
    const items = load()
    const current = items.find((item) => item.id === id)
    if (!current) throw new Error('Peça não encontrada.')
    const updated = { ...current, ...patch }
    save(items.map((item) => (item.id === id ? updated : item)))
    return updated
  },

  /** Soma `delta` ao estoque atual (sem sobrescrever), para que cliques rápidos não se percam. */
  async adjustStock(id: string, delta: number): Promise<CatalogItem> {
    await simulateLatency(120)
    const items = load()
    const current = items.find((item) => item.id === id)
    if (!current) throw new Error('Peça não encontrada.')
    const updated = { ...current, stock: Math.max(0, current.stock + delta) }
    save(items.map((item) => (item.id === id ? updated : item)))
    return updated
  },

  async remove(id: string): Promise<void> {
    await simulateLatency(200)
    save(load().filter((item) => item.id !== id))
  },

  /** Baixa o estoque de um pedido. Falha, sem alterar nada, se alguma peça não tiver saldo. */
  async reserveStock(lines: StockReservation[]): Promise<CatalogItem[]> {
    const items = load()
    for (const line of lines) {
      const item = items.find((candidate) => candidate.id === line.productId)
      if (!item || !item.active) throw new Error('Uma das peças do pedido não está mais disponível.')
      if (item.stock < line.quantity) {
        throw new Error(
          item.stock === 0 ? `“${item.title}” esgotou.` : `Só restam ${item.stock} unidade(s) de “${item.title}”.`,
        )
      }
    }
    const next = items.map((item) => {
      const line = lines.find((candidate) => candidate.productId === item.id)
      return line ? { ...item, stock: item.stock - line.quantity } : item
    })
    save(next)
    return next
  },
}

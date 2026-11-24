import { catalogRequest } from './catalogRequest'
import type { CatalogItem, CatalogItemInput, Owner } from './catalogTypes'

/** Mutations to the product catalog initiated by artisan management flows. */
export const artisanCatalogService = {
  async create(owner: Owner, input: CatalogItemInput): Promise<CatalogItem> {
    return catalogRequest<CatalogItem>('/produtos', {
      method: 'POST',
      body: JSON.stringify({ ...input, ownerEmail: owner.email, artisan: owner.name }),
    })
  },

  async update(id: string, patch: Partial<CatalogItemInput>): Promise<CatalogItem> {
    return catalogRequest<CatalogItem>(`/produtos/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  },

  async remove(id: string): Promise<void> {
    await catalogRequest<void>(`/produtos/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
}

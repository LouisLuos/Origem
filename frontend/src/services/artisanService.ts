import { artisanSpotlights } from '@/data/mockArtisans'
import type { ArtisanSpotlight } from '@/data/mockArtisans'
import { simulateLatency } from './storage'

export type Artisan = ArtisanSpotlight

/** Equivalente a `GET /artesaos`. Fonte: `data/mockArtisans.ts`. */
export const artisanService = {
  async list(): Promise<Artisan[]> {
    await simulateLatency(300)
    return artisanSpotlights
  },
}

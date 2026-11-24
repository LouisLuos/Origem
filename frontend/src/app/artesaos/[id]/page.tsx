import { notFound } from 'next/navigation'
import { isApiError } from '@/services/api'
import type { Metadata } from 'next'
import { artisanService } from '@/services/artisanService'
import { ArtisanProfile } from '@/views/ArtisanProfile'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  try {
    const artisan = await artisanService.get(id)
    const description = artisan.bio || `Conheça ${artisan.name}, mestre artesão de ${artisan.hub}.`
    return {
      title: artisan.name,
      description,
      openGraph: {
        title: artisan.name,
        description,
        images: artisan.coverUrl ? [artisan.coverUrl] : artisan.photoUrl ? [artisan.photoUrl] : undefined,
      },
    }
  } catch {
    // Sem a API, a página continua abrindo com o título padrão; a própria tela mostra o erro.
    return {}
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const artisan = await artisanService.get(id)
    return <ArtisanProfile initialArtisan={artisan} />
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound()
    return <ArtisanProfile />
  }
}

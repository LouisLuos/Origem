import type { Metadata } from 'next'
import { artisanService } from '@/services/artisanService'
import { ArtisanProfile } from '@/views/ArtisanProfile'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  try {
    const artisan = await artisanService.get(id)
    return { title: artisan.name, description: artisan.bio }
  } catch {
    // Sem a API, a página continua abrindo com o título padrão; a própria tela mostra o erro.
    return {}
  }
}

export default function Page() {
  return <ArtisanProfile />
}

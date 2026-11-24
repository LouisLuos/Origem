import { notFound } from 'next/navigation'
import { isApiError } from '@/services/api'
import type { Metadata } from 'next'
import { catalogService } from '@/services/catalogService'
import { ProductDetail } from '@/views/ProductDetail'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  try {
    const product = await catalogService.get(id)
    return {
      title: product.title,
      description: product.description || `${product.title}: ${product.technique} de ${product.hub}, por ${product.artisan}.`,
    }
  } catch {
    // Sem a API, a página continua abrindo com o título padrão; a própria tela mostra o erro.
    return {}
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const product = await catalogService.get(id)
    return <ProductDetail initialProduct={product} />
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound()
  }
  return <ProductDetail />
}

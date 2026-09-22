import { ArrowRight } from 'lucide-react'
import { cn } from '@/design-system/cn'

export interface PromoTileProps {
  eyebrow: string
  title: string
  description: string
  imageUrl: string
  imageAlt: string
  tone?: 'oliva' | 'terracota'
  className?: string
}

export function PromoTile({ eyebrow, title, description, imageUrl, imageAlt, tone = 'oliva', className }: PromoTileProps) {
  const toneClasses = tone === 'oliva' ? 'bg-oliva-50 text-oliva-700' : 'bg-terracota-50 text-terracota-700'

  return (
    <div className={cn('relative flex flex-col overflow-hidden rounded-lg shadow-soft', toneClasses, className)}>
      <div className="flex flex-1 flex-col justify-center gap-3 p-6">
        <span className="text-sm font-semibold">{eyebrow}</span>
        <h3 className="text-2xl font-semibold leading-tight">{title}</h3>
        <p className="text-sm opacity-80">{description}</p>
        <a href="#vitrine" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline">
          Descobrir
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
      <img src={imageUrl} alt={imageAlt} loading="lazy" className="h-40 w-full object-cover" />
    </div>
  )
}

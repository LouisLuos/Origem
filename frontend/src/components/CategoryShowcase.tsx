import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Container, SectionHeading } from '@/design-system'
import { techniques } from '@/design-system/tokens'
import { useProductFilter } from '@/context/ProductFilterContext'

const categoryImages: Record<(typeof techniques)[number], string> = {
  'Cerâmica Figurativa': 'https://picsum.photos/seed/origem-cat-ceramica/480/560',
  'Renda Renascença': 'https://picsum.photos/seed/origem-cat-renda/480/560',
  Xilogravura: 'https://picsum.photos/seed/origem-cat-xilogravura/480/560',
  Marcenaria: 'https://picsum.photos/seed/origem-cat-marcenaria/480/560',
  Cordel: 'https://picsum.photos/seed/origem-cat-cordel/480/560',
  Bordado: 'https://picsum.photos/seed/origem-cat-bordado/480/560',
}

export function CategoryShowcase() {
  const trackRef = useRef<HTMLDivElement>(null)
  const { selectTechnique } = useProductFilter()

  const scrollByCard = (direction: 1 | -1) => {
    const track = trackRef.current
    if (!track) return
    const card = track.querySelector<HTMLElement>('[data-carousel-item]')
    const distance = (card?.offsetWidth ?? 280) + 24
    track.scrollBy({ left: distance * direction, behavior: 'smooth' })
  }

  return (
    <section id="categorias" className="py-16 sm:py-20 bg-aubergine-400/10">
      <Container className="flex flex-col gap-10">
        <SectionHeading
          title="Categorias e seleções"
          description="Cada polo cultural de Pernambuco com sua marca própria."
          action={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => scrollByCard(-1)}
                aria-label="Categoria anterior"
                className="flex h-11 w-11 items-center justify-center border border-aubergine/30 text-aubergine transition-colors hover:border-aubergine hover:bg-aubergine/5 cursor-pointer"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollByCard(1)}
                aria-label="Próxima categoria"
                className="flex h-11 w-11 items-center justify-center border border-aubergine/30 text-aubergine transition-colors hover:border-aubergine hover:bg-aubergine/5 cursor-pointer"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          }
        />

        <div
          ref={trackRef}
          className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth sm:gap-6"
        >
          {techniques.map((technique) => (
            <a
              key={technique}
              href="#vitrine"
              data-carousel-item
              onClick={() => selectTechnique(technique)}
              className="group relative aspect-4/5 w-[65vw] shrink-0 snap-start overflow-hidden bg-surface-muted shadow-soft sm:w-70"
            >
              <img
                src={categoryImages[technique]}
                alt={`Peças de ${technique}`}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-aubergine-600/60" aria-hidden="true" />
              <span className="absolute inset-0 flex items-center justify-center px-4 text-center text-md font-semibold text-terracota-50 sm:text-lg uppercase leading-tight tracking-wider" aria-hidden="true">
                {technique}
              </span>
            </a>
          ))}
        </div>
      </Container>
    </section>
  )
}

import { Link } from 'react-router-dom'
import { Container, SectionHeading } from '@/design-system'
import { artisanSpotlights } from '@/data/mockArtisans'

export function ArtisanSpotlight() {
  return (
    <section id="artesaos" className="py-16 sm:py-20">
      <Container className="flex flex-col gap-10">
        <SectionHeading
          title="Mestres e mestras do artesanato pernambucano"
          description="Quem transforma técnica e tradição em arte."
          align="center"
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {artisanSpotlights.slice(0, 3).map((artisan) => (
            <Link key={artisan.id} to={`/artesaos/${artisan.id}`} className="flex cursor-pointer flex-col">
              <div className="overflow-hidden">
                <img
                  src={artisan.photoUrl}
                  alt={artisan.photoAlt}
                  loading="lazy"
                  className="h-96 w-full object-cover object-top transition-transform duration-300 hover:scale-105"
                />
              </div>
              <div className="flex flex-col items-center gap-1 pt-4 text-center">
                <span className="text-[11px] uppercase tracking-widest text-ink-soft/70">
                  {artisan.technique} · {artisan.hub}
                </span>
                <h3 className="text-sm font-medium uppercase tracking-wide text-ink">{artisan.name}</h3>
                <p className="text-xs text-ink-soft">{artisan.bio}</p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  )
}

import { Container, SectionHeading } from '@/design-system'
import { artisanSpotlights } from '@/data/mockArtisans'

export function ArtisanSpotlight() {
  return (
    <section id="artesaos" className="py-16 sm:py-20">
      <Container className="flex flex-col gap-10">
        <SectionHeading
          title="Mestres e mestras do artesanato pernambucano"
          description="Por trás de cada peça existe uma trajetória. Conheça quem transforma técnica e tradição em objetos únicos."
          align="center"
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {artisanSpotlights.map((artisan) => (
            <article key={artisan.id} className="flex flex-col overflow-hidden rounded-lg bg-surface shadow-soft">
              <img
                src={artisan.photoUrl}
                alt={artisan.photoAlt}
                loading="lazy"
                className="h-64 w-full object-cover"
              />
              <div className="flex flex-col gap-2 p-6">
                <span className="text-sm font-medium text-oliva-600">
                  {artisan.technique} · {artisan.hub}
                </span>
                <h3 className="text-xl font-semibold text-aubergine">{artisan.name}</h3>
                <p className="text-sm text-ink-soft">{artisan.bio}</p>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  )
}

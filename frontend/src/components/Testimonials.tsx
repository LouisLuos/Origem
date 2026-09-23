import { Star } from 'lucide-react'
import { Container, SectionHeading } from '@/design-system'
import { testimonials } from '@/data/mockTestimonials'

export function Testimonials() {
  return (
    <section className="bg-aubergine-400/10 py-16 sm:py-20">
      <Container className="flex flex-col gap-10">
        <SectionHeading
          title="Quem já levou um pedaço de Pernambuco"
          description="Histórias de quem recebeu peças feitas à mão por nossos artesãos."
          align="center"
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <figure key={testimonial.id} className="flex flex-col items-center gap-3 text-center">
              <div className="flex gap-0.5 text-terracota-500" aria-hidden="true">
                {Array.from({ length: testimonial.rating }).map((_, index) => (
                  <Star key={index} className="h-4 w-4" fill="currentColor" strokeWidth={0} />
                ))}
              </div>

              <blockquote className="text-sm leading-relaxed text-ink-soft">“{testimonial.quote}”</blockquote>

              <figcaption className="mt-2 flex flex-col items-center gap-2">
                <img
                  src={testimonial.avatarUrl}
                  alt={testimonial.avatarAlt}
                  loading="lazy"
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-ink">{testimonial.name}</span>
                  <span className="text-xs text-ink-soft/70">{testimonial.location}</span>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  )
}

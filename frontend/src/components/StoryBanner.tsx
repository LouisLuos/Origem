import { Container } from '@/design-system'

export function StoryBanner() {
  return (
    <section id="historia" className="bg-surface-muted py-16 sm:py-20">
      <Container className="grid items-center gap-10 lg:grid-cols-2">
        <img
          src="https://picsum.photos/seed/origem-historia-1/700/560"
          alt="Artesão moldando barro à mão em ateliê iluminado naturalmente"
          className="h-64 w-full rounded-lg object-cover shadow-soft sm:h-80 lg:h-[420px]"
          loading="lazy"
        />

        <div className="flex flex-col gap-4">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            Feito à mão. <br /> Enraizado na tradição.
          </h2>
          <p className="text-base text-ink-soft">
            Cada peça do Origem carrega o território de onde nasce: o barro do Alto do Moura, os fios da
            renda de Nazaré da Mata, a madeira entalhada em Garanhuns. Conectamos artesãos e mestres
            populares diretamente a quem valoriza autenticidade, sem intermediários que apagam essa história.
          </p>
          <a
            href="#artesaos"
            className="mt-1 inline-flex w-fit items-center gap-1.5 border-b-2 border-terracota pb-0.5 text-sm font-semibold text-terracota-600 hover:text-terracota-700"
          >
            Conheça os artesãos por trás das peças
          </a>
        </div>
      </Container>
    </section>
  )
}

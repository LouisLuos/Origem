import { ArrowRight } from 'lucide-react'
import { Button, Container } from '@/design-system'

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-aubergine text-creme-50">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 20%, var(--color-terracota) 0%, transparent 45%), radial-gradient(circle at 85% 80%, var(--color-oliva) 0%, transparent 50%)',
        }}
        aria-hidden="true"
      />

      <Container className="relative flex flex-col-reverse items-center gap-10 py-16 lg:flex-row lg:py-24">
        <div className="flex max-w-xl flex-col items-start gap-6 text-left">
          <h1 className="text-4xl font-semibold leading-[1.05] text-creme-50 sm:text-5xl lg:text-6xl">
            Da mão do artesão, <span className="text-terracota-400">direto</span> pra sua casa.
          </h1>
          <p className="text-lg text-creme-100/90">
            Origem conecta você às técnicas e aos polos culturais de Pernambuco — cerâmica figurativa,
            renda renascença, xilogravura e marcenaria — comprando direto de quem faz, sem intermediários.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" size="lg">
              Explorar a vitrine
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-creme-50/40 text-creme-50 hover:border-creme-50 hover:bg-creme-50/10"
            >
              Sou artesão(ã)
            </Button>
          </div>
        </div>

        <div className="grid w-full max-w-lg shrink-0 grid-cols-2 gap-4">
          <img
            src="https://picsum.photos/seed/origem-hero-1/500/650"
            alt="Mãos moldando peça de cerâmica em torno de oleiro"
            className="col-span-2 h-64 w-full rounded-lg object-cover shadow-lift sm:h-80"
          />
          <img
            src="https://picsum.photos/seed/origem-hero-2/300/300"
            alt="Detalhe de renda renascença artesanal"
            className="h-36 w-full rounded-lg object-cover shadow-soft sm:h-40"
          />
          <img
            src="https://picsum.photos/seed/origem-hero-3/300/300"
            alt="Gravura em madeira típica de cordel nordestino"
            className="h-36 w-full rounded-lg object-cover shadow-soft sm:h-40"
          />
        </div>
      </Container>
    </section>
  )
}

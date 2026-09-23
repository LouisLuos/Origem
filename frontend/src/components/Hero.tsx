import { Button } from '@/design-system'
import heroBackground from '@/assets/hero-background.jpg'

export function Hero() {
  return (
    <section id="top" className="fixed inset-0 z-0 flex items-end overflow-hidden">
      <img
        src={heroBackground}
        alt="Cabeças de cerâmica figurativa em argila crua, ainda sem queima, enfileiradas em um ateliê de Pernambuco"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: '50% 70%' }}
      />
      <div className="absolute inset-0 bg-aubergine/25" aria-hidden="true" />

      <div className="relative w-full px-4 pb-14 sm:px-6 sm:pb-16 lg:px-8 lg:pb-20">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6">
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.05] text-creme-50 sm:text-5xl lg:text-6xl">
            Da mão do artesão, direto pra sua casa.
          </h1>
          <Button
            variant="light"
            size="lg"
            className="hover:bg-terracota hover:text-white cursor-pointer"
            onClick={() => document.querySelector('#vitrine')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Explorar a vitrine
          </Button>
        </div>
      </div>
    </section>
  )
}

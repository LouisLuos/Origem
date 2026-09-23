import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { CategoryShowcase } from '@/components/CategoryShowcase'
import { FeaturedShowcase } from '@/components/FeaturedShowcase'
import { ArtisanSpotlight } from '@/components/ArtisanSpotlight'
import { Newsletter } from '@/components/Newsletter'
import { Footer } from '@/components/Footer'

export function Home() {
  return (
    <>
      <a
        href="#vitrine"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-terracota focus:px-5 focus:py-3 focus:text-creme-50"
      >
        Pular para o conteúdo principal
      </a>
      <Header />
      <main>
        <Hero />
        <div className="h-screen" aria-hidden="true" />
        <div className="relative z-10 bg-creme">
          <CategoryShowcase />
          <FeaturedShowcase />
          <ArtisanSpotlight />
          <Newsletter />
        </div>
      </main>
      <Footer />
    </>
  )
}

import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { TechniqueStrip } from '@/components/TechniqueStrip'
import { FeaturedShowcase } from '@/components/FeaturedShowcase'
import { StoryBanner } from '@/components/StoryBanner'
import { ArtisanSpotlight } from '@/components/ArtisanSpotlight'
import { Newsletter } from '@/components/Newsletter'
import { Footer } from '@/components/Footer'

export function Home() {
  return (
    <>
      <a
        href="#vitrine"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-terracota focus:px-5 focus:py-3 focus:text-creme-50"
      >
        Pular para o conteúdo principal
      </a>
      <Header />
      <main>
        <Hero />
        <TechniqueStrip />
        <FeaturedShowcase />
        <StoryBanner />
        <ArtisanSpotlight />
        <Newsletter />
      </main>
      <Footer />
    </>
  )
}

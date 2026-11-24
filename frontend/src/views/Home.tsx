import { Hero } from '@/components/Hero'
import { CategoryShowcase } from '@/components/CategoryShowcase'
import { FeaturedShowcase } from '@/components/FeaturedShowcase'
import { ArtisanSpotlight } from '@/components/ArtisanSpotlight'

export function Home() {
  return (
    <main id="main-content">
      <Hero />
      <div className="h-screen" aria-hidden="true" />
      <div className="relative z-10 bg-creme">
        <CategoryShowcase />
        <FeaturedShowcase />
        <ArtisanSpotlight />
      </div>
    </main>
  )
}

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Hero } from '@/components/Hero'
import { CategoryShowcase } from '@/components/CategoryShowcase'
import { FeaturedShowcase } from '@/components/FeaturedShowcase'
import { Testimonials } from '@/components/Testimonials'
import { ArtisanSpotlight } from '@/components/ArtisanSpotlight'
import { Newsletter } from '@/components/Newsletter'

export function Home() {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' })
  }, [hash])

  return (
    <main id="main-content">
      <Hero />
      <div className="h-screen" aria-hidden="true" />
      <div className="relative z-10 bg-creme">
        <CategoryShowcase />
        <FeaturedShowcase />
        <Testimonials />
        <ArtisanSpotlight />
        <Newsletter />
      </div>
    </main>
  )
}

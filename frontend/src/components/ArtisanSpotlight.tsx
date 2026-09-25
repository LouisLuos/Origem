import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Container, SectionHeading } from '@/design-system'
import { Input } from '@/design-system'
import { useArtisans } from '@/context/ArtisanContext'
import { ErrorBlock, LoadingBlock } from './AsyncState'

export function ArtisanSpotlight() {
  const { artisans, status, error, reload } = useArtisans()
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
  const filteredArtisans = artisans.filter((artisan) =>
    [artisan.name, artisan.hub, artisan.technique].some((field) => field.toLocaleLowerCase('pt-BR').includes(normalizedQuery)),
  )

  return (
    <section id="artesaos" className="py-16 sm:py-20">
      <Container className="flex flex-col gap-10">
        <SectionHeading
          title="Mestres e mestras do artesanato pernambucano"
          description="Quem transforma técnica e tradição em arte."
          align="center"
        />

        <div className="mx-auto w-full max-w-xl">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
            <Input
              label="Buscar artesãos"
              hideLabel
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Busque por nome, técnica ou região"
              className="pl-11"
            />
          </div>
        </div>

        {status === 'loading' && <LoadingBlock label="Carregando artesãos…" />}
        {status === 'error' && <ErrorBlock message={error} onRetry={reload} />}

        {status === 'ready' && filteredArtisans.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-soft">Nenhum artesão encontrado para essa busca.</p>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredArtisans.slice(0, 3).map((artisan) => (
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

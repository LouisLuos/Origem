import { useState } from 'react'
import { Chip, Container } from '@/design-system'
import { techniques } from '@/design-system/tokens'

/** Filtro rápido por técnica artesanal — atalho para RF-CAT-02 (Filtragem Avançada). */
export function TechniqueStrip() {
  const [active, setActive] = useState<string>('Todas')
  const options = ['Todas', ...techniques]

  return (
    <section id="tecnicas" aria-label="Filtrar por técnica" className="border-b border-border/70 bg-surface py-5">
      <Container>
        <ul className="flex flex-nowrap gap-3 overflow-x-auto pb-1" role="list">
          {options.map((technique) => (
            <li key={technique}>
              <Chip active={active === technique} onClick={() => setActive(technique)}>
                {technique}
              </Chip>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

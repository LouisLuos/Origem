import type { FormHTMLAttributes, ReactNode } from 'react'
import { cn } from '../cn'

type HeadingLevel = 'h2' | 'h3'

export interface SectionTitleProps {
  children: ReactNode
  description?: ReactNode
  as?: HeadingLevel
  id?: string
  /** Ação alinhada à direita (ex.: botão "Adicionar"). */
  action?: ReactNode
  className?: string
}

/** Título de seção dentro de uma página: pequeno, em maiúsculas e espaçado. */
export function SectionTitle({ children, description, as: Heading = 'h2', id, action, className }: SectionTitleProps) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        <Heading id={id} className="text-sm font-semibold uppercase tracking-widest text-ink">
          {children}
        </Heading>
        {description && <p className="pt-1 text-sm text-ink-soft">{description}</p>}
      </div>
      {action}
    </div>
  )
}

type PanelTone = 'muted' | 'surface'

const panelTones: Record<PanelTone, string> = {
  muted: 'bg-aubergine-400/10',
  surface: 'bg-surface',
}

export interface PanelProps extends FormHTMLAttributes<HTMLElement> {
  tone?: PanelTone
  as?: 'section' | 'div' | 'form' | 'aside'
}

/**
 * Bloco com borda que agrupa um formulário ou um conjunto de informações.
 * `muted` (padrão) destaca formulários; `surface` serve a cartões de leitura.
 */
export function Panel({ tone = 'muted', as: Element = 'section', className, children, ...props }: PanelProps) {
  return (
    <Element className={cn('flex flex-col gap-4 border border-border p-6', panelTones[tone], className)} {...props}>
      {children}
    </Element>
  )
}

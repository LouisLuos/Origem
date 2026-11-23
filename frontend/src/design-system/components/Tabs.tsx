'use client'

import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { cn } from '../cn'

export interface TabItem<T extends string> {
  id: T
  label: string
}

export interface TabsProps<T extends string> {
  items: readonly TabItem<T>[]
  value: T
  onChange: (id: T) => void
  /** Nome acessível do grupo de abas. */
  label: string
  /** Prefixo dos ids: a aba é `${idPrefix}-tab-${id}` e o painel, `${idPrefix}-panel-${id}`. */
  idPrefix: string
  className?: string
}

export function tabPanelProps(idPrefix: string, id: string) {
  return {
    id: `${idPrefix}-panel-${id}`,
    role: 'tabpanel' as const,
    'aria-labelledby': `${idPrefix}-tab-${id}`,
    tabIndex: 0,
  }
}

/** Abas acessíveis: setas, Home e End movem a seleção; só a aba ativa entra na ordem do Tab. */
export function Tabs<T extends string>({ items, value, onChange, label, idPrefix, className }: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1
    const target =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
        : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
          : event.key === 'Home' ? 0
            : event.key === 'End' ? last
              : null
    if (target === null) return
    event.preventDefault()
    const item = items[target]
    if (!item) return
    onChange(item.id)
    refs.current[target]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('grid border border-border', className)}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item, index) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            ref={(element) => {
              refs.current[index] = element
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'cursor-pointer px-3 py-2.5 text-sm font-medium transition-colors',
              selected ? 'bg-terracota text-creme-50' : 'text-ink-soft hover:text-ink',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

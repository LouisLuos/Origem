import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { techniques, culturalHubs } from '@/design-system/tokens'
import { priceRangeOptions, useProductFilter } from '@/context/ProductFilterContext'

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-b border-border py-4 first:pt-0" open>
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-widest text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden="true" className="text-base leading-none text-ink-soft group-open:hidden">
          +
        </span>
        <span aria-hidden="true" className="hidden text-base leading-none text-ink-soft group-open:inline">
          −
        </span>
      </summary>
      <div className="flex flex-col gap-1 pt-3">{children}</div>
    </details>
  )
}

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="group flex cursor-pointer items-center gap-2.5 py-1 text-sm text-ink-soft transition-colors hover:text-ink">
      <span
        className="relative flex h-4 w-4 shrink-0 items-center justify-center border border-border bg-surface transition-colors group-has-checked:border-terracota group-has-checked:bg-terracota"
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <Check
          className="h-3 w-3 text-creme-50 opacity-0 transition-opacity group-has-checked:opacity-100"
          aria-hidden="true"
          strokeWidth={3}
        />
      </span>
      {label}
    </label>
  )
}

export function ProductFilters() {
  const { techniques: activeTechniques, toggleTechnique, hubs: activeHubs, toggleHub, priceRanges, togglePriceRange } =
    useProductFilter()

  return (
    <aside className="w-full shrink-0 lg:w-64">
      <FilterSection title="Técnica">
        {techniques.map((technique) => (
          <FilterCheckbox
            key={technique}
            label={technique}
            checked={activeTechniques.includes(technique)}
            onChange={() => toggleTechnique(technique)}
          />
        ))}
      </FilterSection>

      <FilterSection title="Polo cultural">
        {culturalHubs.map((hub) => (
          <FilterCheckbox key={hub} label={hub} checked={activeHubs.includes(hub)} onChange={() => toggleHub(hub)} />
        ))}
      </FilterSection>

      <FilterSection title="Preço">
        {priceRangeOptions.map((range) => (
          <FilterCheckbox
            key={range.id}
            label={range.label}
            checked={priceRanges.includes(range.id)}
            onChange={() => togglePriceRange(range.id)}
          />
        ))}
      </FilterSection>
    </aside>
  )
}

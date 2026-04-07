import { clsx } from 'clsx'
import {
  NeighborhoodProvider,
  type Neighborhood,
} from '../../contexts/NeighborhoodContext'
import { WallLabel } from '../aesthetic/WallLabel'
import { NEIGHBORHOOD_DEFINITIONS } from '../../lib/sim-config'

export interface NeighborhoodMapProps {
  selected: Neighborhood
  onSelect: (n: Neighborhood) => void
}

const ORDER: Neighborhood[] = [
  'gallery',
  'warehouse',
  'flatlands',
  'hotel',
  'online',
]

export function NeighborhoodMap({ selected, onSelect }: NeighborhoodMapProps) {
  return (
    <NeighborhoodProvider neighborhood={selected}>
      <section
        data-testid="neighborhood-map"
        className="border border-rule p-3 bg-paper"
      >
        <div className="mb-2">
          <WallLabel size="sm">NEIGHBORHOOD</WallLabel>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {ORDER.map((id) => {
            const def = NEIGHBORHOOD_DEFINITIONS[id]
            const isSelected = id === selected
            return (
              <button
                key={id}
                type="button"
                data-neighborhood-btn={id}
                aria-pressed={isSelected}
                onClick={() => onSelect(id)}
                className={clsx(
                  'border p-2 text-left uppercase tracking-[0.14em]',
                  isSelected
                    ? 'border-ink bg-[var(--color-accent)]/10 text-ink font-bold'
                    : 'border-rule text-ink-soft hover:border-ink',
                )}
              >
                <WallLabel size="sm">{def.label}</WallLabel>
              </button>
            )
          })}
        </div>
      </section>
    </NeighborhoodProvider>
  )
}

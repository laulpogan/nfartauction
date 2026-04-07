import { v4 as uuid } from 'uuid'
import { WallLabel } from '../aesthetic/WallLabel'
import { ReceiptRow } from '../aesthetic/Receipt'
import { SLOT_DEFINITIONS } from '../../lib/sim-config'
import type { TimeSlot } from '../../types/game'
import type { Neighborhood } from '../../contexts/NeighborhoodContext'

export interface SlotPickerProps {
  slotsRemaining: number
  currentNeighborhood: Neighborhood
  draftSlots: TimeSlot[]
  onAddSlot: (slot: TimeSlot) => void
  onRemoveSlot: (id: string) => void
}

const formatDelta = (n: number) =>
  `${n >= 0 ? '+' : ''}${n.toLocaleString('en-US')}`

export function SlotPicker({
  slotsRemaining,
  currentNeighborhood,
  draftSlots,
  onAddSlot,
  onRemoveSlot,
}: SlotPickerProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <WallLabel size="sm">SLOTS</WallLabel>
        <WallLabel size="sm">{slotsRemaining} REMAINING</WallLabel>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Object.values(SLOT_DEFINITIONS).map((def) => (
          <button
            key={def.type}
            type="button"
            data-slot-type={def.type}
            disabled={slotsRemaining === 0}
            onClick={() =>
              onAddSlot({
                id: uuid(),
                type: def.type,
                neighborhood: currentNeighborhood,
              })
            }
            className="border border-rule p-3 text-left disabled:opacity-40 hover:bg-[var(--color-accent)]/5 bg-paper"
          >
            <WallLabel size="md">{def.label}</WallLabel>
            <p className="text-xs text-ink-soft mt-1">{def.description}</p>
            <div className="mt-2">
              <ReceiptRow label="MONEY" value={formatDelta(def.money)} />
            </div>
          </button>
        ))}
      </div>
      {draftSlots.length > 0 && (
        <div className="border border-rule p-3 bg-paper space-y-1">
          <WallLabel size="sm">DRAFT</WallLabel>
          <ul className="space-y-1">
            {draftSlots.map((slot) => {
              const def = SLOT_DEFINITIONS[slot.type]
              return (
                <li
                  key={slot.id}
                  className="flex items-baseline justify-between gap-2 text-sm border-b border-dashed border-rule pb-1"
                >
                  <span className="uppercase tracking-[0.12em] text-ink">
                    {def.label}
                    <span className="text-ink-soft ml-2">
                      {slot.neighborhood ?? ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`remove ${slot.id}`}
                    onClick={() => onRemoveSlot(slot.id)}
                    className="text-ink-soft hover:text-[var(--color-stamp)] text-xs uppercase tracking-[0.18em]"
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => (props: any) => <div {...props} /> }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

import { SlotPicker } from './SlotPicker'
import { SLOT_DEFINITIONS } from '../../lib/sim-config'
import type { TimeSlot } from '../../types/game'

const noop = () => {}

describe('SlotPicker', () => {
  it('renders all 6 SLOT_DEFINITIONS as buttons', () => {
    render(
      <SlotPicker
        slotsRemaining={4}
        currentNeighborhood="gallery"
        draftSlots={[]}
        onAddSlot={noop}
        onRemoveSlot={noop}
      />,
    )
    for (const def of Object.values(SLOT_DEFINITIONS)) {
      expect(screen.getAllByText(def.label).length).toBeGreaterThan(0)
    }
    // 6 enabled buttons
    const buttons = screen.getAllByRole('button').filter((b) =>
      b.getAttribute('data-slot-type'),
    )
    expect(buttons.length).toBe(6)
  })

  it('clicking a slot button calls onAddSlot with the right type and neighborhood', () => {
    const onAddSlot = vi.fn()
    render(
      <SlotPicker
        slotsRemaining={4}
        currentNeighborhood="warehouse"
        draftSlots={[]}
        onAddSlot={onAddSlot}
        onRemoveSlot={noop}
      />,
    )
    const partyButton = screen.getByRole('button', { name: /PARTY/i })
    fireEvent.click(partyButton)
    expect(onAddSlot).toHaveBeenCalledTimes(1)
    const arg = onAddSlot.mock.calls[0][0] as TimeSlot
    expect(arg.type).toBe('party')
    expect(arg.neighborhood).toBe('warehouse')
    expect(typeof arg.id).toBe('string')
    expect(arg.id.length).toBeGreaterThan(0)
  })

  it('disables buttons when slotsRemaining === 0', () => {
    render(
      <SlotPicker
        slotsRemaining={0}
        currentNeighborhood="gallery"
        draftSlots={[]}
        onAddSlot={noop}
        onRemoveSlot={noop}
      />,
    )
    const buttons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('data-slot-type'))
    for (const b of buttons) {
      expect((b as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('draftSlots remove button calls onRemoveSlot with the id', () => {
    const onRemoveSlot = vi.fn()
    const draftSlots: TimeSlot[] = [
      { id: 'slot-1', type: 'party', neighborhood: 'gallery' },
    ]
    render(
      <SlotPicker
        slotsRemaining={3}
        currentNeighborhood="gallery"
        draftSlots={draftSlots}
        onAddSlot={noop}
        onRemoveSlot={onRemoveSlot}
      />,
    )
    const removeBtn = screen.getByRole('button', { name: /remove slot-1/i })
    fireEvent.click(removeBtn)
    expect(onRemoveSlot).toHaveBeenCalledWith('slot-1')
  })
})

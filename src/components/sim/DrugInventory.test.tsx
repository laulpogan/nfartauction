import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { DrugInventory } from './DrugInventory'
import { createInitialPlayerSimState } from '../../lib/sim-config'
import { addDrugItem } from '../../lib/sim-engine'
import type { PlayerSimState } from '../../types/game'

function makePlayerSim(
  overrides: Partial<PlayerSimState> = {},
): PlayerSimState {
  return { ...createInitialPlayerSimState('s0'), ...overrides }
}

describe('DrugInventory', () => {
  it('renders null when playerSim is null', () => {
    const { container } = render(<DrugInventory playerSim={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders an empty state row when drugs is empty', () => {
    const ps = makePlayerSim()
    const { container } = render(<DrugInventory playerSim={ps} />)
    expect(container.textContent).toContain('no acquisitions')
    // No data-drug-id rows when empty
    expect(container.querySelectorAll('[data-drug-id]').length).toBe(0)
  })

  it('renders one data-drug-id row per item with display strings', () => {
    let ps = makePlayerSim()
    ps = addDrugItem(ps, 'coke', 'drug-1')
    ps = addDrugItem(ps, 'mdma', 'drug-2')
    const { container } = render(<DrugInventory playerSim={ps} />)
    const rows = container.querySelectorAll('[data-drug-id]')
    expect(rows.length).toBe(2)
    expect(rows[0].getAttribute('data-drug-id')).toBe('drug-1')
    expect(rows[1].getAttribute('data-drug-id')).toBe('drug-2')
    expect(container.textContent).toContain('Untitled (White)')
    expect(container.textContent).toContain('Heart in Hand')
  })

  it('renders displayMeta alongside displayLabel', () => {
    let ps = makePlayerSim()
    ps = addDrugItem(ps, 'coke', 'drug-1')
    const { container } = render(<DrugInventory playerSim={ps} />)
    expect(container.textContent).toContain('mixed media, 2024')
  })

  it('renders INVENTORY title on the AppraisalForm', () => {
    const ps = makePlayerSim()
    const { container } = render(<DrugInventory playerSim={ps} />)
    expect(container.textContent).toContain('INVENTORY')
    expect(container.textContent).toContain('I-08')
  })
})

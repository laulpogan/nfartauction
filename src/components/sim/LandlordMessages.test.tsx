import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LandlordMessages } from './LandlordMessages'
import { createInitialPlayerSimState } from '../../lib/sim-config'
import { LANDLORD_MESSAGES } from '../../lib/sim-engine'
import type { PlayerSimState } from '../../types/game'

function makePlayerSim(
  overrides: Partial<PlayerSimState> = {},
): PlayerSimState {
  return { ...createInitialPlayerSimState('s0'), ...overrides }
}

describe('LandlordMessages', () => {
  it('renders nothing when playerSim is null', () => {
    const { container } = render(<LandlordMessages playerSim={null} />)
    expect(container.querySelectorAll('[data-stage]').length).toBe(0)
  })

  it('renders exactly one bubble when seenLandlordStages=[1]', () => {
    const ps = makePlayerSim({ landlordStage: 1, seenLandlordStages: [1] })
    const { container } = render(<LandlordMessages playerSim={ps} />)
    const bubbles = container.querySelectorAll('[data-stage]')
    expect(bubbles.length).toBe(1)
    expect(bubbles[0].getAttribute('data-stage')).toBe('1')
    expect(bubbles[0].textContent).toContain(LANDLORD_MESSAGES[1])
  })

  it('renders three bubbles for seenLandlordStages=[1,2,3] with stage 3 accented', () => {
    const ps = makePlayerSim({
      landlordStage: 3,
      seenLandlordStages: [1, 2, 3],
    })
    const { container } = render(<LandlordMessages playerSim={ps} />)
    const bubbles = container.querySelectorAll('[data-stage]')
    expect(bubbles.length).toBe(3)
    // Last bubble has the accent border class
    const last = bubbles[bubbles.length - 1]
    expect(last.className).toMatch(/accent/)
    // Earlier bubbles should NOT carry the accent class
    expect(bubbles[0].className).not.toMatch(/accent/)
  })

  it('data-stage attributes match the stage numbers in order', () => {
    const ps = makePlayerSim({
      landlordStage: 4,
      seenLandlordStages: [1, 2, 3, 4],
    })
    const { container } = render(<LandlordMessages playerSim={ps} />)
    const bubbles = Array.from(container.querySelectorAll('[data-stage]'))
    const stages = bubbles.map(b => b.getAttribute('data-stage'))
    expect(stages).toEqual(['1', '2', '3', '4'])
  })

  it('renders the FROM: BUILDING MGMT section header', () => {
    const ps = makePlayerSim()
    const { container } = render(<LandlordMessages playerSim={ps} />)
    expect(container.textContent).toContain('FROM: BUILDING MGMT')
  })
})

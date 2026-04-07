import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StatDisplay } from './StatDisplay'
import { createInitialPlayerSimState } from '../../lib/sim-config'
import type { PlayerSimState, PublicPlayer } from '../../types/game'

function makePlayer(overrides: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    id: 'p0',
    sessionId: 's0',
    displayName: 'Test',
    position: 0,
    money: 100000,
    paintingCount: 0,
    paintings: [],
    isHost: true,
    coolness: 0,
    prestige: 0,
    ...overrides,
  }
}

function makeSim(overrides: Partial<PlayerSimState> = {}): PlayerSimState {
  return { ...createInitialPlayerSimState('s0'), ...overrides }
}

describe('StatDisplay', () => {
  it('hides the RISK row when playerSim.risk is 0', () => {
    const { container } = render(
      <StatDisplay player={makePlayer()} playerSim={makeSim({ risk: 0 })} />,
    )
    expect(container.textContent).not.toContain('RISK')
  })

  it('shows the RISK row when playerSim.risk > 0', () => {
    const { container } = render(
      <StatDisplay player={makePlayer()} playerSim={makeSim({ risk: 17 })} />,
    )
    expect(container.textContent).toContain('RISK')
    expect(container.textContent).toContain('17')
  })

  it('shows COOLNESS / RESTEDNESS / LUCK rows with any playerSim', () => {
    const { container } = render(
      <StatDisplay player={makePlayer()} playerSim={makeSim()} />,
    )
    expect(container.textContent).toContain('COOLNESS')
    expect(container.textContent).toContain('RESTEDNESS')
    expect(container.textContent).toContain('LUCK')
  })
})

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RelationshipPanel } from './RelationshipPanel'
import { createInitialPlayerSimState } from '../../lib/sim-config'
import { seedDroppedArtist } from '../../lib/sim-engine'
import type { Artist, PlayerSimState } from '../../types/game'

const ZERO_ROUND_VALUES: Record<Artist, number> = {
  lite_metal: 0,
  yoko: 0,
  christine_p: 0,
  karl_gitter: 0,
  krypto: 0,
}

function makePlayerSim(): PlayerSimState {
  return createInitialPlayerSimState('s0')
}

describe('RelationshipPanel', () => {
  it('renders one row per relationship in playerSim (10 characters)', () => {
    render(
      <RelationshipPanel playerSim={makePlayerSim()} roundValues={ZERO_ROUND_VALUES} />,
    )
    const ids = document.querySelectorAll('[data-relationship-id]')
    expect(ids.length).toBe(10)
  })

  it('renders a COLD chip for a relationship with score < 25', () => {
    const ps = makePlayerSim()
    // Force one relationship cold.
    ps.relationships = ps.relationships.map((r, i) =>
      i === 0 ? { ...r, score: 10 } : r,
    )
    render(<RelationshipPanel playerSim={ps} roundValues={ZERO_ROUND_VALUES} />)
    const cold = document.querySelectorAll('[data-cold]')
    expect(cold.length).toBe(1)
  })

  it('renders a DROPPED chip for the dropped artist relationship', () => {
    const ps = seedDroppedArtist(makePlayerSim(), 'krypto')
    render(<RelationshipPanel playerSim={ps} roundValues={ZERO_ROUND_VALUES} />)
    const dropped = document.querySelectorAll('[data-dropped]')
    expect(dropped.length).toBe(1)
    // Dropped artist must NOT also render a COLD chip even though score < 25.
    const cold = document.querySelectorAll('[data-cold]')
    expect(cold.length).toBe(0)
  })

  it('shows CREDIBILITY row with negative penalty when dropped artist has market value', () => {
    const ps = seedDroppedArtist(makePlayerSim(), 'lite_metal')
    const rv: Record<Artist, number> = { ...ZERO_ROUND_VALUES, lite_metal: 20000 }
    render(<RelationshipPanel playerSim={ps} roundValues={rv} />)
    const cred = document.querySelector('[data-credibility-penalty]') as HTMLElement | null
    expect(cred).not.toBeNull()
    const value = Number(cred!.getAttribute('data-credibility-penalty'))
    expect(value).toBeLessThan(0)
  })

  it('hides CREDIBILITY row when no dropped artist is set', () => {
    render(
      <RelationshipPanel playerSim={makePlayerSim()} roundValues={ZERO_ROUND_VALUES} />,
    )
    const cred = document.querySelector('[data-credibility-penalty]')
    expect(cred).toBeNull()
  })

  it('renders a faction alignment summary row', () => {
    render(
      <RelationshipPanel playerSim={makePlayerSim()} roundValues={ZERO_ROUND_VALUES} />,
    )
    const faction = document.querySelector('[data-faction-summary]')
    expect(faction).not.toBeNull()
    expect(faction!.textContent).toMatch(/PAINTERS/)
  })

  it('renders nothing when playerSim is null', () => {
    const { container } = render(
      <RelationshipPanel playerSim={null} roundValues={ZERO_ROUND_VALUES} />,
    )
    expect(container.firstChild).toBeNull()
  })
})

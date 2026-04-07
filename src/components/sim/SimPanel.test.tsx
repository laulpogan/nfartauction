import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => (props: any) => <div {...props} /> }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

import { SimPanel } from './SimPanel'
import { useSimSessionStore } from '../../stores/useSimSessionStore'
import type { GameState, PlayerSimState } from '../../types/game'
import { createInitialSimState } from '../../lib/sim-config'

function makeGame(): GameState {
  return {
    id: 'g1',
    code: 'ABCD',
    status: 'playing',
    round: 1,
    currentPlayerIdx: 0,
    artistCounts: { lite_metal: 0, yoko: 0, christine_p: 0, karl_gitter: 0, krypto: 0 },
    roundValues: { lite_metal: 0, yoko: 0, christine_p: 0, karl_gitter: 0, krypto: 0 },
    roundHistory: [],
    deck: [],
    auction: null,
    players: [
      {
        id: 'p1',
        sessionId: 'sess-1',
        displayName: 'Alice',
        position: 0,
        money: 100000,
        paintingCount: 0,
        paintings: [],
        isHost: true,
        coolness: 20,
        prestige: 0,
      },
    ],
    phase: { type: 'sim_day', dayNumber: 1, submittedSessionIds: [] },
    sim: { ...createInitialSimState(), dayNumber: 1 },
  }
}

const playerSim: PlayerSimState = {
  sessionId: 'sess-1',
  coolness: 20,
  restedness: 80,
  luck: 50,
  currentNeighborhood: 'gallery',
  scheduledSlots: [],
  drugInventory: [],
  relationships: [],
  faction: null,
}

describe('SimPanel', () => {
  beforeEach(() => {
    useSimSessionStore.setState({ draftSlots: [], isSubmitting: false })
  })

  it('renders DAY label with the current day number', () => {
    render(
      <SimPanel
        game={makeGame()}
        playerSim={playerSim}
        sessionId="sess-1"
        submitSlots={vi.fn()}
      />,
    )
    expect(screen.getByText(/DAY 1/)).toBeTruthy()
  })

  it('renders all 6 slot picker buttons', () => {
    render(
      <SimPanel
        game={makeGame()}
        playerSim={playerSim}
        sessionId="sess-1"
        submitSlots={vi.fn()}
      />,
    )
    const slotButtons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('data-slot-type'))
    expect(slotButtons.length).toBe(6)
  })

  it('renders all 5 neighborhood buttons', () => {
    render(
      <SimPanel
        game={makeGame()}
        playerSim={playerSim}
        sessionId="sess-1"
        submitSlots={vi.fn()}
      />,
    )
    const hoodButtons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('data-neighborhood-btn'))
    expect(hoodButtons.length).toBe(5)
  })

  it('SUBMIT button is disabled when no draft slots are picked', () => {
    render(
      <SimPanel
        game={makeGame()}
        playerSim={playerSim}
        sessionId="sess-1"
        submitSlots={vi.fn()}
      />,
    )
    const submit = screen.getByRole('button', { name: /SUBMIT DAY/i })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
  })

  it('SUBMIT button enables after a slot is added via the store', () => {
    render(
      <SimPanel
        game={makeGame()}
        playerSim={playerSim}
        sessionId="sess-1"
        submitSlots={vi.fn()}
      />,
    )
    // Seed the zustand draft directly so the panel re-renders with an enabled submit.
    act(() => {
      useSimSessionStore.setState({
        draftSlots: [{ id: 's1', type: 'party', neighborhood: 'gallery' }],
        isSubmitting: false,
      })
    })
    const submit = screen.getByRole('button', { name: /SUBMIT DAY/i })
    expect((submit as HTMLButtonElement).disabled).toBe(false)
  })

  it('renders Money from player.money (single source of truth)', () => {
    render(
      <SimPanel
        game={makeGame()}
        playerSim={playerSim}
        sessionId="sess-1"
        submitSlots={vi.fn()}
      />,
    )
    expect(screen.getByText(/\$100,000/)).toBeTruthy()
  })
})

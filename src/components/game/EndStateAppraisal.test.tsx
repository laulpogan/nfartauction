import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock framer-motion so jsdom doesn't touch animation code.
vi.mock('framer-motion', () => {
  const passthrough = (Tag: string) =>
    ({ children, ...props }: any) => {
      const {
        initial, animate, exit, transition, variants, whileHover, whileTap,
        custom, layout, layoutId, ...rest
      } = props
      return <Tag {...rest}>{children}</Tag>
    }
  return {
    motion: new Proxy({}, { get: (_t, key: string) => passthrough(key as any) }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
  }
})

import type { GameState, FinalAppraisal, GameStatus } from '../../types/game'
import { EndStateAppraisal } from './EndStateAppraisal'

function makeGame(status: GameStatus = 'game_over'): GameState {
  return {
    id: 'g1',
    code: 'ABCD',
    status,
    round: 4,
    currentPlayerIdx: 0,
    artistCounts: { lite_metal: 0, yoko: 0, christine_p: 0, karl_gitter: 0, krypto: 0 },
    roundValues: { lite_metal: 0, yoko: 0, christine_p: 0, karl_gitter: 0, krypto: 0 },
    roundHistory: [],
    deck: [],
    auction: null,
    players: [
      { id: 'p0', sessionId: 's0', displayName: 'Alice', position: 0, money: 50000, paintingCount: 0, paintings: [], isHost: true,  coolness: 0, prestige: 0 },
      { id: 'p1', sessionId: 's1', displayName: 'Bob',   position: 1, money: 90000, paintingCount: 0, paintings: [], isHost: false, coolness: 0, prestige: 0 },
      { id: 'p2', sessionId: 's2', displayName: 'Carol', position: 2, money: 70000, paintingCount: 0, paintings: [], isHost: false, coolness: 0, prestige: 0 },
    ],
    phase: { type: 'game_over' },
    sim: {
      dayNumber: 0,
      artMarketHotness: 1.0,
      gentrificationLevel: 3,
      nftHypeCycle: 30,
      neighborhoods: ['gallery', 'warehouse', 'flatlands', 'hotel', 'online'],
    },
  }
}

function makeAppraisal(overrides: Partial<FinalAppraisal> & Pick<FinalAppraisal, 'sessionId' | 'displayName'>): FinalAppraisal {
  return {
    finalMoney: 0,
    factionMix: { painters: 0, sculptors: 0, video_art: 0, social_political: 0 },
    dominantFaction: null,
    neighborhoodsVisited: [],
    roundsInFlatlands: 0,
    nftExposure: { heldCount: 0, walletBalance: 0, unlocked: false },
    keyRelationships: [],
    threeSentenceEpitaph: 'a quiet run through the gallery.',
    ...overrides,
  }
}

describe('EndStateAppraisal', () => {
  it('returns null when game.status !== game_over', () => {
    const { container } = render(
      <EndStateAppraisal
        game={makeGame('playing')}
        appraisals={null}
        myPlayerIdx={0}
        onPlayAgain={() => {}}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders WINNER block with the top-money player', () => {
    render(
      <EndStateAppraisal
        game={makeGame()}
        appraisals={null}
        myPlayerIdx={0}
        onPlayAgain={() => {}}
      />,
    )
    // Bob has 90000 (top). WINNER block should contain BOB.
    expect(screen.getByText('BOB')).toBeTruthy()
    expect(screen.getByTestId('winner-subheader').textContent).toContain('DECLARED THE WINNER')
  })

  it('renders one ReceiptRow per player sorted by money desc', () => {
    render(
      <EndStateAppraisal
        game={makeGame()}
        appraisals={null}
        myPlayerIdx={0}
        onPlayAgain={() => {}}
      />,
    )
    const leaderboard = screen.getByTestId('leaderboard')
    const rows = leaderboard.querySelectorAll('[data-receipt-label]')
    expect(rows.length).toBe(3)
    // Order: Bob (90000) → Carol (70000) → Alice (50000)
    expect(rows[0].textContent).toContain('1. BOB')
    expect(rows[1].textContent).toContain('2. CAROL')
    expect(rows[2].textContent).toContain('3. ALICE')
  })

  it("marks the local player with '(YOU)'", () => {
    render(
      <EndStateAppraisal
        game={makeGame()}
        appraisals={null}
        myPlayerIdx={0}
        onPlayAgain={() => {}}
      />,
    )
    // Alice is myPlayerIdx=0
    const leaderboard = screen.getByTestId('leaderboard')
    expect(leaderboard.textContent).toContain('ALICE (YOU)')
  })

  it('renders one appraisal section per player when appraisals provided', () => {
    const appraisals: Record<string, FinalAppraisal> = {
      s0: makeAppraisal({ sessionId: 's0', displayName: 'Alice' }),
      s1: makeAppraisal({ sessionId: 's1', displayName: 'Bob' }),
      s2: makeAppraisal({ sessionId: 's2', displayName: 'Carol' }),
    }
    render(
      <EndStateAppraisal
        game={makeGame()}
        appraisals={appraisals}
        myPlayerIdx={0}
        onPlayAgain={() => {}}
      />,
    )
    expect(screen.getByTestId('appraisal-s0')).toBeTruthy()
    expect(screen.getByTestId('appraisal-s1')).toBeTruthy()
    expect(screen.getByTestId('appraisal-s2')).toBeTruthy()
  })

  it('renders threeSentenceEpitaph text inside each appraisal section', () => {
    const appraisals: Record<string, FinalAppraisal> = {
      s0: makeAppraisal({
        sessionId: 's0',
        displayName: 'Alice',
        threeSentenceEpitaph: 'alpha sentence here. beta sentence here. gamma sentence here.',
      }),
      s1: makeAppraisal({ sessionId: 's1', displayName: 'Bob' }),
      s2: makeAppraisal({ sessionId: 's2', displayName: 'Carol' }),
    }
    render(
      <EndStateAppraisal
        game={makeGame()}
        appraisals={appraisals}
        myPlayerIdx={0}
        onPlayAgain={() => {}}
      />,
    )
    expect(screen.getByTestId('epitaph-s0').textContent).toContain('alpha sentence here')
  })

  it('falls back to leaderboard-only when appraisals is null', () => {
    render(
      <EndStateAppraisal
        game={makeGame()}
        appraisals={null}
        myPlayerIdx={0}
        onPlayAgain={() => {}}
      />,
    )
    expect(screen.getByTestId('leaderboard')).toBeTruthy()
    expect(screen.queryByTestId('appraisal-sections')).toBeNull()
  })

  it('BACK TO LOBBY button calls onPlayAgain on click', () => {
    const spy = vi.fn()
    render(
      <EndStateAppraisal
        game={makeGame()}
        appraisals={null}
        myPlayerIdx={0}
        onPlayAgain={spy}
      />,
    )
    fireEvent.click(screen.getByText('BACK TO LOBBY'))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('renders key relationship rows when appraisal has keyRelationships', () => {
    const appraisals: Record<string, FinalAppraisal> = {
      s0: makeAppraisal({
        sessionId: 's0',
        displayName: 'Alice',
        keyRelationships: [
          { displayName: 'Helena V.', score: 80, status: 'kept' },
        ],
      }),
      s1: makeAppraisal({ sessionId: 's1', displayName: 'Bob' }),
      s2: makeAppraisal({ sessionId: 's2', displayName: 'Carol' }),
    }
    render(
      <EndStateAppraisal
        game={makeGame()}
        appraisals={appraisals}
        myPlayerIdx={0}
        onPlayAgain={() => {}}
      />,
    )
    expect(screen.getByText('Helena V.: kept')).toBeTruthy()
  })
})

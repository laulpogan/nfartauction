import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

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

import type { GameState, FinalAppraisal } from '../../types/game'
import { GameOverModal } from './GameOverModal'

function makeGame(): GameState {
  return {
    id: 'g1',
    code: 'ABCD',
    status: 'game_over',
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

describe('GameOverModal', () => {
  it('renders EndStateAppraisal with null appraisals (fallback)', () => {
    render(
      <GameOverModal
        game={makeGame()}
        appraisals={null}
        myPlayerIdx={0}
        onPlayAgain={() => {}}
      />,
    )
    expect(screen.getByTestId('leaderboard')).toBeTruthy()
    expect(screen.queryByTestId('appraisal-sections')).toBeNull()
  })

  it('renders EndStateAppraisal with populated appraisals', () => {
    const appraisals: Record<string, FinalAppraisal> = {
      s0: {
        sessionId: 's0',
        displayName: 'Alice',
        finalMoney: 50000,
        factionMix: { painters: 0, sculptors: 0, video_art: 0, social_political: 0 },
        dominantFaction: null,
        neighborhoodsVisited: [],
        roundsInFlatlands: 0,
        nftExposure: { heldCount: 0, walletBalance: 0, unlocked: false },
        keyRelationships: [],
        threeSentenceEpitaph: 'signature epitaph text.',
      },
      s1: {
        sessionId: 's1',
        displayName: 'Bob',
        finalMoney: 90000,
        factionMix: { painters: 0, sculptors: 0, video_art: 0, social_political: 0 },
        dominantFaction: null,
        neighborhoodsVisited: [],
        roundsInFlatlands: 0,
        nftExposure: { heldCount: 0, walletBalance: 0, unlocked: false },
        keyRelationships: [],
        threeSentenceEpitaph: 'bob epitaph.',
      },
    }
    render(
      <GameOverModal
        game={makeGame()}
        appraisals={appraisals}
        myPlayerIdx={0}
        onPlayAgain={() => {}}
      />,
    )
    expect(screen.getByTestId('appraisal-sections')).toBeTruthy()
    expect(screen.getByTestId('epitaph-s0').textContent).toContain('signature epitaph')
  })

  it('displays BOB as the winner (top money)', () => {
    render(
      <GameOverModal
        game={makeGame()}
        appraisals={null}
        myPlayerIdx={0}
        onPlayAgain={() => {}}
      />,
    )
    expect(screen.getByText('BOB')).toBeTruthy()
  })
})

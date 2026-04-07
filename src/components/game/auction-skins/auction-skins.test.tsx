import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock framer-motion so jsdom doesn't touch animation code.
vi.mock('framer-motion', () => {
  const passthrough = (Tag: string) =>
    ({ children, ...props }: any) => {
      // Strip framer-only props so React doesn't warn.
      const {
        initial, animate, exit, transition, variants, whileHover, whileTap,
        custom, layout, layoutId, ...rest
      } = props
      return <Tag {...rest}>{children}</Tag>
    }
  return {
    motion: new Proxy(
      {},
      {
        get: (_t, key: string) => passthrough(key as any),
      },
    ),
    AnimatePresence: ({ children }: any) => <>{children}</>,
  }
})

import type { GameState, AuctionState, AuctionType } from '../../../types/game'
import { OpenAuctionSkin } from './OpenAuctionSkin'
import { OnceAroundSkin } from './OnceAroundSkin'
import { SealedBidSkin } from './SealedBidSkin'
import { FixedPriceSkin } from './FixedPriceSkin'
import { DoubleSkin } from './DoubleSkin'
import { AuctionPanel } from '../AuctionPanel'

function makeAuction(type: AuctionType, overrides: Partial<AuctionState> = {}): AuctionState {
  return {
    id: 'auction-1',
    auctioneerIdx: 0,
    cards: [{ id: 'c1', artist: 'yoko', auctionType: type }],
    auctionType: type,
    status: type === 'fixed_price' ? 'set_price' : 'active',
    fixedPrice: type === 'fixed_price' ? 15000 : null,
    currentBid: 0,
    leadingBidderIdx: null,
    sealedBids: {},
    onceAroundBids: {},
    onceAroundCurrentIdx: 0,
    waitingSecondCardIdx: 0,
    winnerIdx: null,
    finalPrice: null,
    ...overrides,
  }
}

function makeFixture(type: AuctionType, auctionOverrides: Partial<AuctionState> = {}): GameState {
  return {
    id: 'game-1',
    code: 'ABCD',
    status: 'playing',
    round: 1,
    currentPlayerIdx: 0,
    artistCounts: { lite_metal: 0, yoko: 0, christine_p: 0, karl_gitter: 0, krypto: 0 },
    roundValues: { lite_metal: 0, yoko: 0, christine_p: 0, karl_gitter: 0, krypto: 0 },
    roundHistory: [],
    deck: [],
    auction: makeAuction(type, auctionOverrides),
    players: [
      { id: 'p0', sessionId: 's0', displayName: 'Alice', position: 0, money: 100000, paintingCount: 0, paintings: [], isHost: true,  coolness: 0, prestige: 0 },
      { id: 'p1', sessionId: 's1', displayName: 'Bob',   position: 1, money: 100000, paintingCount: 0, paintings: [], isHost: false, coolness: 0, prestige: 0 },
      { id: 'p2', sessionId: 's2', displayName: 'Carol', position: 2, money: 100000, paintingCount: 0, paintings: [], isHost: false, coolness: 0, prestige: 0 },
    ],
    phase: { type: 'lobby' },
    sim: {
      dayNumber: 0,
      artMarketHotness: 1.0,
      gentrificationLevel: 3,
      nftHypeCycle: 30,
      neighborhoods: ['gallery', 'warehouse', 'flatlands', 'hotel', 'online'],
    },
  }
}

const noop = () => {}
const noopN = (_n: number) => {}
const noopNullable = (_n: number | null) => {}

function baseProps(game: GameState) {
  return {
    game,
    myPlayerIdx: 0,
    isAuctioneer: true,
    myMoney: 100000,
    onSetFixedPrice: noopN,
    onAcceptFixedPrice: noop,
    onPassFixedPrice: noop,
    onPlaceOpenBid: noopN,
    onEndOpenAuction: noop,
    onPlaceOnceAroundBid: noopNullable,
    onSubmitSealedBid: noopN,
  }
}

describe('Auction skins', () => {
  it('OpenAuctionSkin renders without throwing', () => {
    const game = makeFixture('open')
    render(<OpenAuctionSkin {...baseProps(game)} />)
    expect(screen.getByTestId('skin-open')).toBeTruthy()
  })

  it('OnceAroundSkin renders without throwing', () => {
    const game = makeFixture('once_around')
    render(<OnceAroundSkin {...baseProps(game)} />)
    expect(screen.getByTestId('skin-once-around')).toBeTruthy()
  })

  it('SealedBidSkin renders without throwing', () => {
    const game = makeFixture('sealed_bid')
    render(<SealedBidSkin {...baseProps(game)} />)
    expect(screen.getByTestId('skin-sealed-bid')).toBeTruthy()
  })

  it('FixedPriceSkin renders without throwing', () => {
    const game = makeFixture('fixed_price')
    render(<FixedPriceSkin {...baseProps(game)} />)
    expect(screen.getByTestId('skin-fixed-price')).toBeTruthy()
  })

  it('DoubleSkin renders without throwing', () => {
    const game = makeFixture('double', { status: 'waiting_second' })
    render(<DoubleSkin {...baseProps(game)} />)
    expect(screen.getByTestId('skin-double')).toBeTruthy()
  })

  it('DoubleSkin DOM contains bg-ink (dark override)', () => {
    const game = makeFixture('double', { status: 'waiting_second' })
    const { container } = render(<DoubleSkin {...baseProps(game)} />)
    const darkEl = container.querySelector('[class*="bg-ink"]')
    expect(darkEl).toBeTruthy()
  })
})

describe('AuctionPanel dispatcher', () => {
  it('renders SealedBidSkin when auction.auctionType === sealed_bid', () => {
    const game = makeFixture('sealed_bid')
    render(<AuctionPanel {...baseProps(game)} />)
    expect(screen.getByTestId('skin-sealed-bid')).toBeTruthy()
  })

  it('returns null when auction is null', () => {
    const game = makeFixture('open')
    game.auction = null
    const { container } = render(<AuctionPanel {...baseProps(game)} />)
    expect(container.textContent).toBe('')
  })
})

import { describe, it, expect } from 'vitest'
import {
  chooseBotCard,
  chooseBotBid,
  chooseBotSecondCard,
  chooseBotSlots,
} from './bot-engine'
import type { Card, GameState, AuctionState, PlayerSimState, Artist } from '../types/game'

// ─── Test Helpers ───────────────────────────────────────────────────────────

function makeCard(artist: Artist, auctionType: Card['auctionType'] = 'open', id?: string): Card {
  return { id: id ?? `card-${artist}-${auctionType}`, artist, auctionType }
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    id: 'test',
    code: 'TEST',
    status: 'playing',
    round: 1,
    currentPlayerIdx: 0,
    artistCounts: { lite_metal: 2, yoko: 3, christine_p: 1, karl_gitter: 0, krypto: 0 },
    roundValues: { lite_metal: 30000, yoko: 20000, christine_p: 10000, karl_gitter: 0, krypto: 0 },
    roundHistory: [],
    deck: [],
    auction: null,
    players: [
      { id: '1', sessionId: 's1', displayName: 'P1', position: 0, money: 100000, paintingCount: 0, paintings: [], isHost: true, coolness: 20, prestige: 0 },
      { id: '2', sessionId: 's2', displayName: 'P2', position: 1, money: 100000, paintingCount: 0, paintings: [], isHost: false, coolness: 20, prestige: 0 },
      { id: '3', sessionId: 's3', displayName: 'P3', position: 2, money: 100000, paintingCount: 0, paintings: [], isHost: false, coolness: 20, prestige: 0 },
    ],
    phase: { type: 'auction_round', roundNumber: 1 },
    sim: {
      dayNumber: 1,
      artMarketHotness: 1.0,
      gentrificationLevel: 3,
      nftHypeCycle: 30,
      neighborhoods: ['gallery', 'warehouse', 'flatlands', 'hotel', 'online'],
    },
    ...overrides,
  } as GameState
}

function makeAuction(overrides: Partial<AuctionState> = {}): AuctionState {
  return {
    id: 'auction-1',
    auctioneerIdx: 0,
    cards: [makeCard('lite_metal', 'open')],
    auctionType: 'open',
    status: 'active',
    fixedPrice: null,
    currentBid: 5000,
    leadingBidderIdx: 0,
    sealedBids: {},
    onceAroundBids: {},
    onceAroundCurrentIdx: 1,
    waitingSecondCardIdx: 0,
    winnerIdx: null,
    finalPrice: null,
    ...overrides,
  }
}

function makePlayerSim(overrides: Partial<PlayerSimState> = {}): PlayerSimState {
  return {
    sessionId: 's1',
    coolness: 20,
    restedness: 80,
    luck: 50,
    currentNeighborhood: 'gallery',
    scheduledSlots: [],
    relationships: [],
    drugs: [],
    risk: 0,
    nftWallet: 5,
    nftWalletUnlocked: false,
    heldNfts: [],
    droppedArtist: null,
    landlordStage: 1,
    seenLandlordStages: [1],
    ...overrides,
  }
}

// ─── chooseBotCard ──────────────────────────────────────────────────────────

describe('chooseBotCard', () => {
  const hand: Card[] = [
    makeCard('lite_metal', 'open'),
    makeCard('yoko', 'once_around'),
    makeCard('christine_p', 'sealed_bid'),
  ]

  it('conservative picks highest-value artist (lite_metal=30000)', () => {
    const game = makeGameState()
    const card = chooseBotCard(hand, game, 'conservative', 0.5)
    expect(card.artist).toBe('lite_metal')
  })

  it('aggressive picks trending artist (yoko has highest artistCounts=3)', () => {
    const game = makeGameState()
    const card = chooseBotCard(hand, game, 'aggressive', 0.5)
    expect(card.artist).toBe('yoko')
  })

  it('erratic picks based on random seed', () => {
    const game = makeGameState()
    // random=0.0 -> index 0
    const card0 = chooseBotCard(hand, game, 'erratic', 0.0)
    expect(card0).toBe(hand[0])
    // random=0.99 -> index 2
    const card2 = chooseBotCard(hand, game, 'erratic', 0.99)
    expect(card2).toBe(hand[2])
  })

  it('throws on empty hand', () => {
    const game = makeGameState()
    expect(() => chooseBotCard([], game, 'conservative', 0.5)).toThrow()
  })

  it('avoids double auction type when non-double alternative exists for same artist', () => {
    const doubleHand: Card[] = [
      makeCard('lite_metal', 'double', 'dbl-1'),
      makeCard('lite_metal', 'open', 'open-1'),
      makeCard('yoko', 'once_around', 'ya-1'),
    ]
    const game = makeGameState()
    const card = chooseBotCard(doubleHand, game, 'conservative', 0.5)
    // Should pick lite_metal (highest value) but prefer the non-double card
    expect(card.artist).toBe('lite_metal')
    expect(card.auctionType).not.toBe('double')
  })
})

// ─── chooseBotBid ───────────────────────────────────────────────────────────

describe('chooseBotBid', () => {
  describe('open auction', () => {
    it('returns a bid higher than currentBid', () => {
      const auction = makeAuction({ auctionType: 'open', currentBid: 5000 })
      const game = makeGameState({ auction })
      const bid = chooseBotBid(auction, game, 'aggressive', 100000, 0.5)
      expect(bid).not.toBeNull()
      expect(bid!).toBeGreaterThan(5000)
    })

    it('returns null when money is very low', () => {
      const auction = makeAuction({ auctionType: 'open', currentBid: 50000 })
      const game = makeGameState({ auction })
      const bid = chooseBotBid(auction, game, 'conservative', 10000, 0.5)
      expect(bid).toBeNull()
    })
  })

  describe('once_around auction', () => {
    it('returns a number or null', () => {
      const auction = makeAuction({ auctionType: 'once_around', currentBid: 0 })
      const game = makeGameState({ auction })
      const bid = chooseBotBid(auction, game, 'aggressive', 100000, 0.5)
      if (bid !== null) {
        expect(typeof bid).toBe('number')
        expect(bid).toBeGreaterThan(0)
      }
    })
  })

  describe('sealed_bid auction', () => {
    it('returns a number with wider variance than once_around at same seed', () => {
      const auctionOA = makeAuction({ auctionType: 'once_around', currentBid: 0 })
      const auctionSB = makeAuction({ auctionType: 'sealed_bid', currentBid: 0 })
      const game = makeGameState()
      // Use extreme random values to expose variance difference
      const bidOA_low = chooseBotBid(auctionOA, game, 'erratic', 100000, 0.01)
      const bidOA_high = chooseBotBid(auctionOA, game, 'erratic', 100000, 0.99)
      const bidSB_low = chooseBotBid(auctionSB, game, 'erratic', 100000, 0.01)
      const bidSB_high = chooseBotBid(auctionSB, game, 'erratic', 100000, 0.99)
      // Sealed bid should have wider spread
      const oaRange = Math.abs((bidOA_high ?? 0) - (bidOA_low ?? 0))
      const sbRange = Math.abs((bidSB_high ?? 0) - (bidSB_low ?? 0))
      expect(sbRange).toBeGreaterThanOrEqual(oaRange)
    })
  })

  describe('fixed_price auction', () => {
    it('accepts when price is low relative to perceived value', () => {
      const auction = makeAuction({
        auctionType: 'fixed_price',
        fixedPrice: 5000,
        cards: [makeCard('lite_metal')],
      })
      const game = makeGameState({ auction })
      // lite_metal perceived value is high (30000 base + 2*5000 demand)
      const bid = chooseBotBid(auction, game, 'aggressive', 100000, 0.5)
      expect(bid).toBe(5000) // accepts at fixedPrice
    })

    it('passes when price exceeds perceived value', () => {
      const auction = makeAuction({
        auctionType: 'fixed_price',
        fixedPrice: 90000,
        cards: [makeCard('krypto')],
      })
      const game = makeGameState({ auction })
      // krypto perceived value is 0 + 0*5000 = 0
      const bid = chooseBotBid(auction, game, 'conservative', 100000, 0.5)
      expect(bid).toBeNull()
    })
  })

  describe('double auction', () => {
    it('returns null (bots do not initiate double bids)', () => {
      const auction = makeAuction({ auctionType: 'double' })
      const game = makeGameState({ auction })
      const bid = chooseBotBid(auction, game, 'aggressive', 100000, 0.5)
      expect(bid).toBeNull()
    })
  })
})

// ─── chooseBotSecondCard ────────────────────────────────────────────────────

describe('chooseBotSecondCard', () => {
  it('returns a matching card when one exists in hand', () => {
    const hand: Card[] = [
      makeCard('lite_metal', 'open'),
      makeCard('yoko', 'once_around'),
    ]
    const auction = makeAuction({
      auctionType: 'double',
      status: 'waiting_second',
      cards: [makeCard('lite_metal', 'double')],
    })
    const card = chooseBotSecondCard(hand, auction, 'conservative', 0.5)
    expect(card).not.toBeNull()
    expect(card!.artist).toBe('lite_metal')
  })

  it('returns null when no matching artist in hand', () => {
    const hand: Card[] = [
      makeCard('yoko', 'once_around'),
      makeCard('christine_p', 'sealed_bid'),
    ]
    const auction = makeAuction({
      auctionType: 'double',
      status: 'waiting_second',
      cards: [makeCard('lite_metal', 'double')],
    })
    const card = chooseBotSecondCard(hand, auction, 'aggressive', 0.5)
    expect(card).toBeNull()
  })

  it('conservative prefers non-double type when multiple matching cards exist', () => {
    const hand: Card[] = [
      makeCard('lite_metal', 'double', 'dbl-match'),
      makeCard('lite_metal', 'open', 'open-match'),
    ]
    const auction = makeAuction({
      auctionType: 'double',
      status: 'waiting_second',
      cards: [makeCard('lite_metal', 'double')],
    })
    const card = chooseBotSecondCard(hand, auction, 'conservative', 0.5)
    expect(card).not.toBeNull()
    expect(card!.auctionType).not.toBe('double')
  })
})

// ─── chooseBotSlots ─────────────────────────────────────────────────────────

describe('chooseBotSlots', () => {
  it('returns exactly SLOTS_PER_DAY (4) slots', () => {
    const playerSim = makePlayerSim()
    const game = makeGameState()
    const slots = chooseBotSlots(playerSim, game, 'conservative', 0.5)
    expect(slots).toHaveLength(4)
  })

  it('each slot has a valid id, type, and neighborhood', () => {
    const playerSim = makePlayerSim()
    const game = makeGameState()
    const slots = chooseBotSlots(playerSim, game, 'aggressive', 0.5)
    for (const slot of slots) {
      expect(slot.id).toBeTruthy()
      expect(slot.type).toBeTruthy()
      expect(slot.neighborhood).toBeTruthy()
    }
  })

  it('conservative favors gallery_work and sleep over party', () => {
    const playerSim = makePlayerSim()
    const game = makeGameState()
    // Run multiple samples to get a distribution
    const counts: Record<string, number> = {}
    for (let r = 0; r < 100; r++) {
      const slots = chooseBotSlots(playerSim, game, 'conservative', r / 100)
      for (const s of slots) {
        counts[s.type] = (counts[s.type] ?? 0) + 1
      }
    }
    // gallery_work + sleep should appear more than party + art_fair
    const preferred = (counts['gallery_work'] ?? 0) + (counts['sleep'] ?? 0)
    const avoided = (counts['party'] ?? 0) + (counts['art_fair'] ?? 0)
    expect(preferred).toBeGreaterThan(avoided)
  })

  it('aggressive favors party and art_fair over sleep', () => {
    const playerSim = makePlayerSim()
    const game = makeGameState()
    const counts: Record<string, number> = {}
    for (let r = 0; r < 100; r++) {
      const slots = chooseBotSlots(playerSim, game, 'aggressive', r / 100)
      for (const s of slots) {
        counts[s.type] = (counts[s.type] ?? 0) + 1
      }
    }
    const preferred = (counts['party'] ?? 0) + (counts['art_fair'] ?? 0)
    const avoided = (counts['sleep'] ?? 0) + (counts['gallery_work'] ?? 0)
    expect(preferred).toBeGreaterThan(avoided)
  })

  it('slot neighborhoods come from personality preferences', () => {
    const playerSim = makePlayerSim()
    const game = makeGameState()
    const slots = chooseBotSlots(playerSim, game, 'conservative', 0.5)
    const validNeighborhoods = ['gallery', 'warehouse']
    for (const s of slots) {
      expect(validNeighborhoods).toContain(s.neighborhood)
    }
  })
})

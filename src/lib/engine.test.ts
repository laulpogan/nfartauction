import { describe, it, expect } from 'vitest'
import {
  emptyArtistCounts, startGame, playCard, playSecondCard, passSecondCard,
  setFixedPrice, acceptFixedPrice, passFixedPrice,
  placeOpenBid, endOpenAuction, placeOnceAroundBid, submitSealedBid, endRound,
} from './engine'
import type { GameState, PlayerRecord, Card, Artist, AuctionType } from '../types/game'
import { ROUND_END_THRESHOLD } from '../types/game'

// ─── Test helpers ───────────────────────────────────────────────────────────

function makeTestPlayer(position: number, money = 100000): PlayerRecord {
  return {
    id: `player-${position}`,
    sessionId: `session-${position}`,
    displayName: `Player ${position}`,
    position,
    money,
    hand: [],
    paintings: [],
    isHost: position === 0,
  }
}

function card(artist: Artist, auctionType: AuctionType, tag = 't'): Card {
  return { id: `${artist}_${auctionType}_${tag}`, artist, auctionType }
}

function makeGame(playerCount: number): { game: GameState; players: PlayerRecord[] } {
  const players = Array.from({ length: playerCount }, (_, i) => makeTestPlayer(i))
  const game: GameState = {
    id: 'test',
    code: 'TEST',
    status: 'playing',
    round: 1,
    currentPlayerIdx: 0,
    artistCounts: emptyArtistCounts(),
    roundValues: emptyArtistCounts(),
    roundHistory: [],
    deck: [],
    auction: null,
    players: players.map(p => ({
      id: p.id,
      sessionId: p.sessionId,
      displayName: p.displayName,
      position: p.position,
      money: p.money,
      paintingCount: 0,
      paintings: p.paintings,
      isHost: p.isHost,
    })),
  }
  return { game, players }
}

// Helper: begin an auction of a given type so other helpers can jump to bidding.
function beginAuction(
  playerCount: number,
  auctionType: AuctionType,
  artist: Artist = 'yoko',
): { game: GameState; players: PlayerRecord[] } {
  const { game, players } = makeGame(playerCount)
  const c = card(artist, auctionType)
  const auctioneer = players[0]
  auctioneer.hand = [c]
  const result = playCard(game, auctioneer, c)
  players[0] = result.updatedPlayer
  return { game: result.updatedGame, players }
}

// ─── Round-end trigger (ENG-08) ──────────────────────────────────────────────

describe('round-end trigger', () => {
  it('fires when 5th painting is played: roundEnded true, auction null', () => {
    const { game, players } = makeGame(3)
    // Pre-seed artistCounts to 4 (the 5th painting triggers round end)
    game.artistCounts.yoko = ROUND_END_THRESHOLD - 1
    const c = card('yoko', 'open')
    players[0].hand = [c]

    const result = playCard(game, players[0], c)

    expect(result.roundEnded).toBe(true)
    expect(result.updatedGame.auction).toBeNull()
    expect(result.updatedGame.artistCounts.yoko).toBe(ROUND_END_THRESHOLD)
  })

  it('does NOT fire when 4th painting is played: an auction is created', () => {
    const { game, players } = makeGame(3)
    game.artistCounts.yoko = ROUND_END_THRESHOLD - 2 // 3 → this play makes 4
    const c = card('yoko', 'open')
    players[0].hand = [c]

    const result = playCard(game, players[0], c)

    expect(result.roundEnded).toBe(false)
    expect(result.updatedGame.auction).not.toBeNull()
    expect(result.updatedGame.artistCounts.yoko).toBe(ROUND_END_THRESHOLD - 1)
  })
})

// ─── Open auction ────────────────────────────────────────────────────────────

describe('open auction', () => {
  it('placeOpenBid records current bid and leading bidder', () => {
    const { game, players } = beginAuction(3, 'open')
    const afterBid = placeOpenBid(game, 1, 5000)
    expect(afterBid.auction?.currentBid).toBe(5000)
    expect(afterBid.auction?.leadingBidderIdx).toBe(1)
    // Unused binding is intentional — players here are not altered by placeOpenBid.
    void players
  })

  it('rejects a bid at or below the current bid', () => {
    const { game } = beginAuction(3, 'open')
    const g1 = placeOpenBid(game, 1, 5000)
    expect(() => placeOpenBid(g1, 2, 5000)).toThrow('Bid must exceed current bid')
    expect(() => placeOpenBid(g1, 2, 4000)).toThrow('Bid must exceed current bid')
  })

  it('resolves to the leading bidder; money transfers from buyer to auctioneer', () => {
    const { game, players } = beginAuction(3, 'open')
    const afterBid = placeOpenBid(game, 1, 5000)
    const { updatedPlayers } = endOpenAuction(afterBid, players)
    expect(updatedPlayers[1].money).toBe(100000 - 5000)
    expect(updatedPlayers[0].money).toBe(100000 + 5000)
    expect(updatedPlayers[1].paintings).toHaveLength(1)
    expect(updatedPlayers[1].paintings[0].artist).toBe('yoko')
  })

  it('gives the painting to the auctioneer for free if no bids were placed', () => {
    const { game, players } = beginAuction(3, 'open')
    const { updatedPlayers } = endOpenAuction(game, players)
    expect(updatedPlayers[0].money).toBe(100000)
    expect(updatedPlayers[0].paintings).toHaveLength(1)
  })
})

// ─── Once-around auction ─────────────────────────────────────────────────────

describe('once-around auction', () => {
  it('advances turn without updatedPlayers for non-auctioneer bids', () => {
    const { game, players } = beginAuction(3, 'once_around')
    const result = placeOnceAroundBid(game, players, 1, 3000)
    expect('updatedPlayers' in result).toBe(false)
    expect(result.updatedGame.auction?.onceAroundBids[1]).toBe(3000)
  })

  it('resolves when auctioneer bids last: highest bidder wins', () => {
    const { game, players } = beginAuction(3, 'once_around')
    // Player 1 bids 3000, player 2 bids 5000, auctioneer (0) bids 2000 last.
    const r1 = placeOnceAroundBid(game, players, 1, 3000) as { updatedGame: GameState }
    const r2 = placeOnceAroundBid(r1.updatedGame, players, 2, 5000) as { updatedGame: GameState }
    const r3 = placeOnceAroundBid(r2.updatedGame, players, 0, 2000) as {
      updatedGame: GameState
      updatedPlayers: PlayerRecord[]
    }
    expect(r3.updatedPlayers).toBeDefined()
    expect(r3.updatedPlayers[2].money).toBe(100000 - 5000)
    expect(r3.updatedPlayers[0].money).toBe(100000 + 5000)
    expect(r3.updatedPlayers[2].paintings).toHaveLength(1)
  })

  it('gives painting to auctioneer free when everyone passes', () => {
    const { game, players } = beginAuction(3, 'once_around')
    const r1 = placeOnceAroundBid(game, players, 1, null) as { updatedGame: GameState }
    const r2 = placeOnceAroundBid(r1.updatedGame, players, 2, null) as { updatedGame: GameState }
    const r3 = placeOnceAroundBid(r2.updatedGame, players, 0, null) as {
      updatedGame: GameState
      updatedPlayers: PlayerRecord[]
    }
    expect(r3.updatedPlayers[0].money).toBe(100000)
    expect(r3.updatedPlayers[0].paintings).toHaveLength(1)
  })
})

// ─── Sealed bid — resolution and tie-breaking (ENG-10) ───────────────────────

describe('sealed bid — resolution and tie-breaking', () => {
  it('auctioneer wins when tied with another player (>= rule)', () => {
    const { game, players } = beginAuction(3, 'sealed_bid')
    const r1 = submitSealedBid(game, players, 1, 5000)
    const r2 = submitSealedBid(r1.updatedGame, players, 2, 5000)
    const r3 = submitSealedBid(r2.updatedGame, players, 0, 5000)
    expect(r3.updatedPlayers).toBeDefined()
    // Auctioneer (idx 0) self-buy: pays 5000 to bank, keeps painting.
    expect(r3.updatedPlayers![0].money).toBe(100000 - 5000)
    expect(r3.updatedPlayers![0].paintings).toHaveLength(1)
    expect(r3.updatedPlayers![1].money).toBe(100000)
    expect(r3.updatedPlayers![2].money).toBe(100000)
  })

  it('leftmost non-auctioneer wins a tie between non-auctioneers', () => {
    const { game, players } = beginAuction(3, 'sealed_bid')
    // Auctioneer (0) bids low. Players 1 and 2 both bid 5000.
    // Player 1 is clockwise-first from auctioneer → should win.
    const r1 = submitSealedBid(game, players, 0, 1000)
    const r2 = submitSealedBid(r1.updatedGame, players, 1, 5000)
    const r3 = submitSealedBid(r2.updatedGame, players, 2, 5000)
    expect(r3.updatedPlayers).toBeDefined()
    expect(r3.updatedPlayers![1].money).toBe(100000 - 5000)
    expect(r3.updatedPlayers![1].paintings).toHaveLength(1)
    expect(r3.updatedPlayers![2].money).toBe(100000)
    // Auctioneer gains the 5000
    expect(r3.updatedPlayers![0].money).toBe(100000 + 5000)
  })

  it('gives painting free to auctioneer when every bid is zero', () => {
    const { game, players } = beginAuction(3, 'sealed_bid')
    const r1 = submitSealedBid(game, players, 0, 0)
    const r2 = submitSealedBid(r1.updatedGame, players, 1, 0)
    const r3 = submitSealedBid(r2.updatedGame, players, 2, 0)
    expect(r3.updatedPlayers).toBeDefined()
    expect(r3.updatedPlayers![0].money).toBe(100000)
    expect(r3.updatedPlayers![0].paintings).toHaveLength(1)
  })

  it('does not resolve until the last bid arrives', () => {
    const { game, players } = beginAuction(3, 'sealed_bid')
    const r1 = submitSealedBid(game, players, 0, 3000)
    expect(r1.updatedPlayers).toBeUndefined()
    const r2 = submitSealedBid(r1.updatedGame, players, 1, 4000)
    expect(r2.updatedPlayers).toBeUndefined()
  })
})

// ─── Fixed price auction ─────────────────────────────────────────────────────

describe('fixed price auction', () => {
  it('setFixedPrice records price and status becomes active', () => {
    const { game } = beginAuction(3, 'fixed_price')
    const priced = setFixedPrice(game, 7000)
    expect(priced.auction?.fixedPrice).toBe(7000)
    expect(priced.auction?.status).toBe('active')
  })

  it('acceptFixedPrice (non-self) transfers money to auctioneer', () => {
    const { game, players } = beginAuction(3, 'fixed_price')
    const priced = setFixedPrice(game, 7000)
    const { updatedPlayers } = acceptFixedPrice(priced, players, 2)
    expect(updatedPlayers[2].money).toBe(100000 - 7000)
    expect(updatedPlayers[0].money).toBe(100000 + 7000)
    expect(updatedPlayers[2].paintings).toHaveLength(1)
  })

  it('acceptFixedPrice (self-buy) deducts from auctioneer, no receive', () => {
    const { game, players } = beginAuction(3, 'fixed_price')
    const priced = setFixedPrice(game, 7000)
    const { updatedPlayers } = acceptFixedPrice(priced, players, 0)
    expect(updatedPlayers[0].money).toBe(100000 - 7000)
    expect(updatedPlayers[0].paintings).toHaveLength(1)
  })

  it('passFixedPrice advances clockwise through non-auctioneer players', () => {
    const { game } = beginAuction(3, 'fixed_price')
    const priced = setFixedPrice(game, 7000)
    // onceAroundCurrentIdx starts at player 1 (clockwise of auctioneer 0).
    expect(priced.auction?.onceAroundCurrentIdx).toBe(1)
    const after = passFixedPrice(priced)
    expect(after.auction?.onceAroundCurrentIdx).toBe(2)
  })
})

// ─── Double auction — second card mechanics ─────────────────────────────────

describe('double auction — second card mechanics', () => {
  it('playCard on a double card puts auction in waiting_second with clockwise index', () => {
    const { game, players } = beginAuction(3, 'double')
    expect(game.auction?.status).toBe('waiting_second')
    expect(game.auction?.waitingSecondCardIdx).toBe(1) // clockwise of auctioneer 0
    void players
  })

  it('passSecondCard advances waitingSecondCardIdx clockwise', () => {
    const { game } = beginAuction(3, 'double')
    const r = passSecondCard(game, 1)
    expect(r.auctioneerTakesFree).toBe(false)
    expect(r.updatedGame.auction?.waitingSecondCardIdx).toBe(2)
  })

  it('full clockwise wrap returns painting free to original auctioneer, clears auction', () => {
    const { game } = beginAuction(3, 'double')
    // Pass from idx 1 → 2
    const r1 = passSecondCard(game, 1)
    expect(r1.auctioneerTakesFree).toBe(false)
    // Pass from idx 2 → wraps to auctioneer (0)
    const r2 = passSecondCard(r1.updatedGame, 2)
    expect(r2.auctioneerTakesFree).toBe(true)
    expect(r2.updatedGame.auction).toBeNull()
  })

  it('playSecondCard reassigns auctioneer to the player of the 2nd card', () => {
    const { game, players } = beginAuction(3, 'double')
    const second = card('yoko', 'open', '2nd')
    players[1].hand = [second]
    const result = playSecondCard(game, players[1], second)
    expect(result.updatedGame.auction?.auctioneerIdx).toBe(1)
    expect(result.updatedGame.auction?.status).toBe('active')
    expect(result.updatedGame.auction?.cards).toHaveLength(2)
  })

  it('passSecondCard throws if auction is not in waiting_second', () => {
    const { game } = beginAuction(3, 'open') // not double
    expect(() => passSecondCard(game, 1)).toThrow()
  })
})

// ─── Cumulative round valuation (ENG-10) ─────────────────────────────────────

describe('cumulative round valuation', () => {
  it('round 1: top artist gets 30000; player with that painting gets paid', () => {
    const { game, players } = makeGame(3)
    // Give player 1 a yoko painting; set artistCounts so yoko wins round.
    players[1].paintings = [{ artist: 'yoko', round: 1 }]
    game.artistCounts.yoko = 3
    game.artistCounts.lite_metal = 2
    game.artistCounts.krypto = 1

    const { updatedPlayers, result } = endRound(game, players)
    const topRanking = result.rankings[0]
    expect(topRanking.artist).toBe('yoko')
    expect(topRanking.value).toBe(30000)
    expect(topRanking.cumulativeValue).toBe(30000)
    expect(updatedPlayers[1].money).toBe(100000 + 30000)
  })

  it('round 2: same top artist compounds — cumulativeValue becomes 60000', () => {
    const { game, players } = makeGame(3)
    // Seed roundValues as if round 1 already finished with yoko=30000.
    game.roundValues.yoko = 30000
    game.round = 2
    players[1].paintings = [{ artist: 'yoko', round: 2 }]
    game.artistCounts.yoko = 3
    game.artistCounts.krypto = 2
    game.artistCounts.lite_metal = 1

    const { updatedPlayers, result } = endRound(game, players)
    const topRanking = result.rankings[0]
    expect(topRanking.artist).toBe('yoko')
    expect(topRanking.value).toBe(30000)
    expect(topRanking.cumulativeValue).toBe(60000)
    expect(updatedPlayers[1].money).toBe(100000 + 60000)
  })

  it('player with 2 paintings of top artist is paid 2 × cumulative value', () => {
    const { game, players } = makeGame(3)
    game.roundValues.yoko = 30000
    game.round = 2
    players[2].paintings = [
      { artist: 'yoko', round: 1 },
      { artist: 'yoko', round: 2 },
    ]
    game.artistCounts.yoko = 3
    game.artistCounts.krypto = 2
    game.artistCounts.lite_metal = 1

    const { updatedPlayers } = endRound(game, players)
    expect(updatedPlayers[2].money).toBe(100000 + 2 * 60000)
  })
})

// ─── startGame ───────────────────────────────────────────────────────────────

describe('startGame', () => {
  it('initializes status, hands, money, and a reduced deck', () => {
    const { game, players } = makeGame(3)
    const { updatedGame, updatedPlayers } = startGame(game, players)
    expect(updatedGame.status).toBe('playing')
    expect(updatedGame.round).toBe(1)
    for (const p of updatedPlayers) {
      expect(p.hand.length).toBeGreaterThan(0)
      expect(p.money).toBe(100000)
      expect(p.paintings).toEqual([])
    }
    // 3 players × 10 cards = 30 dealt; 70 - 30 = 40 remaining
    expect(updatedGame.deck.length).toBe(40)
  })
})

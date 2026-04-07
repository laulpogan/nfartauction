import { v4 as uuid } from 'uuid'
import type {
  GameState, PlayerRecord, AuctionState, AuctionType,
  Artist, Card, RoundResult, PublicPlayer,
} from '../types/game'
import { ARTISTS, ROUND_VALUES, ROUND_END_THRESHOLD } from '../types/game'
import { buildDeck, dealHands, shuffle } from './deck'

// ─── Helpers ────────────────────────────────────────────────────────────────

export function makePublicPlayer(p: PlayerRecord): PublicPlayer {
  return {
    id: p.id,
    sessionId: p.sessionId,
    displayName: p.displayName,
    position: p.position,
    money: p.money,
    paintingCount: p.paintings.length,
    paintings: p.paintings,
    isHost: p.isHost,
    // Phase 3 sim-loop public mirror fields. Real values are owned by
    // sim-engine and projected onto the public player record by the server
    // when sim state changes. The defaults here keep lobby-time construction
    // honest before any sim day has run.
    coolness: 0,
    prestige: 0,
  }
}

export function emptyArtistCounts(): Record<Artist, number> {
  return Object.fromEntries(ARTISTS.map(a => [a, 0])) as Record<Artist, number>
}

// ─── Start Game ─────────────────────────────────────────────────────────────

export function startGame(game: GameState, players: PlayerRecord[]): {
  updatedGame: GameState
  updatedPlayers: PlayerRecord[]
} {
  const sorted = [...players].sort((a, b) => a.position - b.position)
  const deck = shuffle(buildDeck())
  const { hands, remaining } = dealHands(deck, sorted.length, 1)

  const updatedPlayers = sorted.map((p, i) => ({
    ...p,
    hand: hands[i],
    money: 100000,
    paintings: [],
  }))

  const updatedGame: GameState = {
    ...game,
    status: 'playing',
    round: 1,
    currentPlayerIdx: 0,
    artistCounts: emptyArtistCounts(),
    roundValues: emptyArtistCounts(),
    roundHistory: [],
    deck: remaining,
    auction: null,
    players: updatedPlayers.map(makePublicPlayer),
  }

  return { updatedGame, updatedPlayers }
}

// ─── Play Card (begin auction) ───────────────────────────────────────────────

export function playCard(
  game: GameState,
  player: PlayerRecord,
  card: Card,
): { updatedGame: GameState; updatedPlayer: PlayerRecord; roundEnded: boolean } {
  // Remove card from hand
  const hand = player.hand.filter(c => c.id !== card.id)
  const updatedPlayer = { ...player, hand }

  // Count this painting
  const artistCounts = { ...game.artistCounts }
  artistCounts[card.artist] = (artistCounts[card.artist] ?? 0) + 1

  // Check if this is the 5th painting → round ends, NO auction
  if (artistCounts[card.artist] >= ROUND_END_THRESHOLD) {
    const updatedGame: GameState = {
      ...game,
      artistCounts,
      auction: null,
      players: game.players.map(p =>
        p.sessionId === player.sessionId ? { ...p, paintingCount: p.paintingCount } : p
      ),
    }
    return { updatedGame, updatedPlayer, roundEnded: true }
  }

  // Create auction
  const auctionId = uuid()
  let auctionType: AuctionType = card.auctionType === 'double' ? 'double' : card.auctionType
  let status: AuctionState['status'] = 'active'

  if (card.auctionType === 'double') status = 'waiting_second'
  else if (card.auctionType === 'fixed_price') status = 'set_price'

  const auction: AuctionState = {
    id: auctionId,
    auctioneerIdx: game.currentPlayerIdx,
    cards: [card],
    auctionType,
    status,
    fixedPrice: null,
    currentBid: 0,
    leadingBidderIdx: null,
    sealedBids: {},
    onceAroundBids: {},
    onceAroundCurrentIdx: (game.currentPlayerIdx + 1) % game.players.length,
    // For 'double' auctions: the player clockwise from the auctioneer plays/passes first.
    // For non-double auctions this field is unused but must be set; default to auctioneer.
    waitingSecondCardIdx: card.auctionType === 'double'
      ? (game.currentPlayerIdx + 1) % game.players.length
      : game.currentPlayerIdx,
    winnerIdx: null,
    finalPrice: null,
  }

  const updatedGame: GameState = {
    ...game,
    artistCounts,
    auction,
    players: game.players.map(p =>
      p.sessionId === player.sessionId
        ? { ...p, paintingCount: p.paintingCount }
        : p
    ),
  }

  return { updatedGame, updatedPlayer, roundEnded: false }
}

// ─── Play Second Card (for Double auction) ────────────────────────────────────

export function playSecondCard(
  game: GameState,
  player: PlayerRecord,
  card: Card,
): { updatedGame: GameState; updatedPlayer: PlayerRecord } {
  if (!game.auction) throw new Error('No active auction')

  const hand = player.hand.filter(c => c.id !== card.id)
  const updatedPlayer = { ...player, hand }

  // Resolved auction type comes from the SECOND card (which must not be 'double')
  const resolvedType: AuctionType = card.auctionType === 'double' ? 'open' : card.auctionType
  let status: AuctionState['status'] = 'active'
  if (resolvedType === 'fixed_price') status = 'set_price'

  // Per official Knizia Modern Art rules: whoever plays the 2nd card becomes
  // the new auctioneer for this lot and collects the proceeds.
  const newAuctioneerIdx = player.position
  const auction: AuctionState = {
    ...game.auction,
    cards: [...game.auction.cards, card],
    auctionType: resolvedType,
    status,
    auctioneerIdx: newAuctioneerIdx,
    waitingSecondCardIdx: newAuctioneerIdx,
    onceAroundCurrentIdx: (newAuctioneerIdx + 1) % game.players.length,
  }

  // Count the second artist painting too
  const artistCounts = { ...game.artistCounts }
  artistCounts[card.artist] = (artistCounts[card.artist] ?? 0) + 1

  const updatedGame: GameState = { ...game, artistCounts, auction }
  return { updatedGame, updatedPlayer }
}

// ─── Pass Second Card (for Double auction) ────────────────────────────────────
//
// Per faithful Knizia rules: any player clockwise from the auctioneer may
// decline to pair the double card. If every player passes back to the original
// auctioneer, the auctioneer takes the single card for free (no auction held).
//
// During 'waiting_second' status, `auction.auctioneerIdx` is still the ORIGINAL
// auctioneer (it only gets reassigned in playSecondCard). So when
// waitingSecondCardIdx wraps back to auctioneerIdx, every other player has
// already passed.
export function passSecondCard(
  game: GameState,
  _passerIdx: number,
): { updatedGame: GameState; auctioneerTakesFree: boolean } {
  if (!game.auction || game.auction.status !== 'waiting_second') {
    throw new Error('No second-card phase active')
  }
  const { auction } = game
  const nextIdx = (auction.waitingSecondCardIdx + 1) % game.players.length

  if (nextIdx === auction.auctioneerIdx) {
    // Full clockwise wrap — every other player passed.
    // Original auctioneer takes the single card for free; no auction is held.
    // The painting was already counted in artistCounts during playCard.
    return {
      updatedGame: {
        ...game,
        auction: null,
        currentPlayerIdx: (game.currentPlayerIdx + 1) % game.players.length,
      },
      auctioneerTakesFree: true,
    }
  }

  return {
    updatedGame: {
      ...game,
      auction: { ...auction, waitingSecondCardIdx: nextIdx },
    },
    auctioneerTakesFree: false,
  }
}

// ─── Set Fixed Price ─────────────────────────────────────────────────────────

export function setFixedPrice(game: GameState, price: number): GameState {
  if (!game.auction) throw new Error('No active auction')
  return {
    ...game,
    auction: {
      ...game.auction,
      fixedPrice: price,
      status: 'active',
      onceAroundCurrentIdx: (game.auction.auctioneerIdx + 1) % game.players.length,
    },
  }
}

// ─── Accept Fixed Price ──────────────────────────────────────────────────────

export function acceptFixedPrice(
  game: GameState,
  players: PlayerRecord[],
  buyerIdx: number,
): { updatedGame: GameState; updatedPlayers: PlayerRecord[] } {
  if (!game.auction || game.auction.fixedPrice === null) throw new Error('No fixed price set')
  const { auction } = game
  const price = auction.fixedPrice!
  const auctioneerIdx = auction.auctioneerIdx
  const isSelfBuy = buyerIdx === auctioneerIdx

  return resolveAuction(game, players, buyerIdx, price, isSelfBuy)
}

// ─── Pass Fixed Price ─────────────────────────────────────────────────────────

export function passFixedPrice(game: GameState): GameState {
  if (!game.auction) throw new Error('No active auction')
  const { auction } = game
  const nextIdx = getNextOnceAroundIdx(game, auction.onceAroundCurrentIdx)

  // If we've gone all the way around back to auctioneer → auctioneer must buy or abort
  // (In the original rules, if no one buys, the auctioneer takes the card free/discards)
  // We'll advance through players; when it wraps back to auctioneer, they auto-win free
  if (nextIdx === auction.auctioneerIdx) {
    // No one wanted it — auctioneer gets it for free (pays bank $0)
    return { ...game, auction: { ...auction, onceAroundCurrentIdx: nextIdx, status: 'active', leadingBidderIdx: auction.auctioneerIdx } }
  }

  return { ...game, auction: { ...auction, onceAroundCurrentIdx: nextIdx } }
}

// ─── Place Open Bid ───────────────────────────────────────────────────────────

export function placeOpenBid(game: GameState, bidderIdx: number, amount: number): GameState {
  if (!game.auction) throw new Error('No active auction')
  if (amount <= game.auction.currentBid) throw new Error('Bid must exceed current bid')
  return {
    ...game,
    auction: {
      ...game.auction,
      currentBid: amount,
      leadingBidderIdx: bidderIdx,
    },
  }
}

// ─── End Open Auction (auctioneer hammers) ────────────────────────────────────

export function endOpenAuction(
  game: GameState,
  players: PlayerRecord[],
): { updatedGame: GameState; updatedPlayers: PlayerRecord[] } {
  if (!game.auction) throw new Error('No active auction')
  const { auction } = game

  if (auction.leadingBidderIdx === null) {
    // No bids — auctioneer gets it free
    return resolveAuction(game, players, auction.auctioneerIdx, 0, false)
  }

  const isSelfBuy = auction.leadingBidderIdx === auction.auctioneerIdx
  return resolveAuction(game, players, auction.leadingBidderIdx, auction.currentBid, isSelfBuy)
}

// ─── Place Once Around Bid ────────────────────────────────────────────────────

export function placeOnceAroundBid(
  game: GameState,
  players: PlayerRecord[],
  bidderIdx: number,
  amount: number | null, // null = pass
): { updatedGame: GameState; updatedPlayers: PlayerRecord[] } | { updatedGame: GameState } {
  if (!game.auction) throw new Error('No active auction')
  const { auction } = game

  const onceAroundBids = { ...auction.onceAroundBids, [bidderIdx]: amount }
  const nextIdx = getNextOnceAroundIdx(game, bidderIdx)
  const isLastBidder = bidderIdx === auction.auctioneerIdx

  if (isLastBidder) {
    // Auctioneer was last — find highest bidder
    const winner = findOnceAroundWinner(onceAroundBids, auction.auctioneerIdx, game.players.length)
    if (winner === null) {
      // Everyone passed → auctioneer gets free
      return resolveAuction({ ...game, auction: { ...auction, onceAroundBids } }, players, auction.auctioneerIdx, 0, false)
    }
    const winAmount = onceAroundBids[winner] ?? 0
    const isSelf = winner === auction.auctioneerIdx
    return resolveAuction({ ...game, auction: { ...auction, onceAroundBids } }, players, winner, winAmount, isSelf)
  }

  return {
    updatedGame: {
      ...game,
      auction: { ...auction, onceAroundBids, onceAroundCurrentIdx: nextIdx },
    },
  }
}

// ─── Submit Sealed Bid ────────────────────────────────────────────────────────

export function submitSealedBid(
  game: GameState,
  players: PlayerRecord[],
  bidderIdx: number,
  amount: number,
): { updatedGame: GameState; updatedPlayers?: PlayerRecord[] } {
  if (!game.auction) throw new Error('No active auction')
  const { auction } = game

  const sealedBids = { ...auction.sealedBids, [bidderIdx]: amount }
  const allSubmitted = game.players.every((_, i) => sealedBids[i] !== undefined)

  if (allSubmitted) {
    // Resolve: highest bidder wins; ties go to leftmost from auctioneer
    let maxBid = -1
    let winnerIdx = auction.auctioneerIdx
    const playerCount = game.players.length

    for (let offset = 1; offset <= playerCount; offset++) {
      const idx = (auction.auctioneerIdx + offset) % playerCount
      const bid = sealedBids[idx] ?? 0
      if (bid > maxBid) { maxBid = bid; winnerIdx = idx }
    }
    // Check auctioneer too
    const auctBid = sealedBids[auction.auctioneerIdx] ?? 0
    if (auctBid >= maxBid && maxBid > 0) { maxBid = auctBid; winnerIdx = auction.auctioneerIdx }

    if (maxBid === 0) {
      // Everyone bid 0 → auctioneer gets free
      return resolveAuction({ ...game, auction: { ...auction, sealedBids } }, players, auction.auctioneerIdx, 0, false)
    }

    const isSelf = winnerIdx === auction.auctioneerIdx
    return resolveAuction({ ...game, auction: { ...auction, sealedBids } }, players, winnerIdx, maxBid, isSelf)
  }

  return { updatedGame: { ...game, auction: { ...auction, sealedBids } } }
}

// ─── Resolve Auction ──────────────────────────────────────────────────────────

function resolveAuction(
  game: GameState,
  players: PlayerRecord[],
  winnerIdx: number,
  price: number,
  isSelfBuy: boolean,
): { updatedGame: GameState; updatedPlayers: PlayerRecord[] } {
  const { auction } = game
  if (!auction) throw new Error('No auction')

  const auctioneerIdx = auction.auctioneerIdx
  const artistsWon = auction.cards.map(c => c.artist)

  const updatedPlayers = players.map((p, idx) => {
    let { money, paintings } = p
    if (idx === winnerIdx) {
      money -= price
      paintings = [...paintings, ...artistsWon.map(artist => ({ artist, round: game.round }))]
    }
    if (isSelfBuy && idx === auctioneerIdx) {
      // Auctioneer self-bought → pays bank (money already deducted above)
    } else if (!isSelfBuy && idx === auctioneerIdx) {
      // Auctioneer receives payment from winner
      money += price
    }
    return { ...p, money, paintings }
  })

  const updatedPublicPlayers = game.players.map((p, idx) => ({
    ...p,
    money: updatedPlayers[idx].money,
    paintingCount: updatedPlayers[idx].paintings.length,
    paintings: updatedPlayers[idx].paintings,
  }))

  // Advance turn
  const nextPlayerIdx = (game.currentPlayerIdx + 1) % game.players.length

  const updatedGame: GameState = {
    ...game,
    currentPlayerIdx: nextPlayerIdx,
    auction: { ...auction, status: 'completed', winnerIdx, finalPrice: price },
    players: updatedPublicPlayers,
  }

  return { updatedGame, updatedPlayers }
}

// ─── End Round ────────────────────────────────────────────────────────────────

export function endRound(
  game: GameState,
  players: PlayerRecord[],
): { updatedGame: GameState; updatedPlayers: PlayerRecord[]; result: RoundResult } {
  const { artistCounts, round } = game

  // Rank artists by paintings offered
  const ranked = ARTISTS
    .map(artist => ({ artist, count: artistCounts[artist] ?? 0 }))
    .sort((a, b) => b.count - a.count)

  // Top 3 get values; 4th and 5th get 0 (and lose carry-over)
  const newValues = { ...game.roundValues }
  const rankings: RoundResult['rankings'] = ranked.map((r, i) => {
    const thisRoundValue = i < 3 ? ROUND_VALUES[i] : 0
    const cumulative = thisRoundValue > 0 ? newValues[r.artist] + thisRoundValue : 0
    newValues[r.artist] = cumulative
    return { artist: r.artist, count: r.count, value: thisRoundValue, cumulativeValue: cumulative }
  })

  // Pay players for paintings
  const payouts: RoundResult['payouts'] = []

  const updatedPlayers = players.map((p, idx) => {
    const breakdown: { artist: Artist; count: number; value: number }[] = []
    let total = 0
    for (const artist of ARTISTS) {
      const owned = p.paintings.filter(pt => pt.artist === artist).length
      const value = newValues[artist] ?? 0
      if (owned > 0) {
        total += owned * value
        breakdown.push({ artist, count: owned, value: value })
      }
    }
    payouts.push({ playerIdx: idx, amount: total, breakdown })
    return { ...p, money: p.money + total, paintings: [] }
  })

  const result: RoundResult = {
    round,
    artistCounts,
    rankings,
    payouts,
  }

  // Deal new cards if not last round
  let newDeck = [...game.deck]
  let newHands = updatedPlayers.map(p => [...p.hand])
  const nextRound = (round + 1) as 1 | 2 | 3 | 4

  if (round < 4) {
    const { hands, remaining } = dealHands(newDeck, players.length, nextRound)
    newDeck = remaining
    newHands = hands
  }

  const finalPlayers = updatedPlayers.map((p, i) => ({
    ...p,
    hand: newHands[i] ?? p.hand,
  }))

  const updatedGame: GameState = {
    ...game,
    status: round >= 4 ? 'game_over' : 'playing',
    round: nextRound,
    currentPlayerIdx: 0,
    artistCounts: emptyArtistCounts(),
    roundValues: newValues,
    roundHistory: [...game.roundHistory, result],
    deck: newDeck,
    auction: null,
    players: finalPlayers.map(makePublicPlayer),
  }

  return { updatedGame, updatedPlayers: finalPlayers, result }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getNextOnceAroundIdx(game: GameState, currentIdx: number): number {
  return (currentIdx + 1) % game.players.length
}

function findOnceAroundWinner(
  bids: Record<number, number | null>,
  auctioneerIdx: number,
  playerCount: number,
): number | null {
  let maxBid = -1
  let winner: number | null = null

  // Go in order starting from left of auctioneer
  for (let offset = 0; offset <= playerCount; offset++) {
    const idx = (auctioneerIdx + offset) % playerCount
    const bid = bids[idx] ?? null
    if (bid !== null && bid > maxBid) {
      maxBid = bid
      winner = idx
    }
  }

  return maxBid > 0 ? winner : null
}

export function isRoundOver(game: GameState): boolean {
  return ARTISTS.some(a => (game.artistCounts[a] ?? 0) >= ROUND_END_THRESHOLD)
}

export function canEndOpenAuction(game: GameState, playerSessionId: string): boolean {
  if (!game.auction) return false
  const auctioneer = game.players[game.auction.auctioneerIdx]
  return auctioneer?.sessionId === playerSessionId
}

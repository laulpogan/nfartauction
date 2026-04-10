// ─── Phase 7: Bot Decision Engine ───────────────────────────────────────────
//
// Pure functional core for all bot decisions. Mirrors the engine.ts and
// sim-engine.ts pattern: state-in / state-out, no side effects, no
// Math.random, no Date.now, no console. All entropy arrives via the `random`
// parameter (0-1) supplied by the server caller.
//
// Functions:
//   perceiveArtistValue — internal: base + demand signal
//   chooseBotCard       — pick a card from hand based on personality
//   chooseBotBid        — return a bid or null for all 5 auction types
//   chooseBotSecondCard — play a matching card for double auctions or pass
//   chooseBotSlots      — generate a sim-day slot plan weighted by personality

import type {
  Artist,
  AuctionState,
  BotPersonality,
  Card,
  GameState,
  PlayerSimState,
  SlotType,
  TimeSlot,
} from '../types/game'
import {
  BOT_CONFIG,
  BOT_SLOT_WEIGHTS,
  BOT_NEIGHBORHOOD_PREFS,
} from './bot-config'
import { SIM_CONFIG } from './sim-config'

// ─── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Estimate an artist's perceived value from the current game state.
 * Base = cumulative roundValues (carry-over from prior rounds).
 * Demand signal = artistCounts * 5000 (more paintings this round = hotter).
 */
function perceiveArtistValue(artist: Artist, game: GameState): number {
  const base = game.roundValues[artist] ?? 0
  const demand = (game.artistCounts[artist] ?? 0) * 5000
  return base + demand
}

/**
 * Weighted random selection from a weight map. Returns the chosen key.
 * `random` must be in [0, 1). Pure: no Math.random.
 */
function weightedPick<K extends string>(
  weights: Record<K, number>,
  random: number,
): K {
  const entries = Object.entries(weights) as [K, number][]
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let roll = random * total
  for (const [key, weight] of entries) {
    roll -= weight
    if (roll <= 0) return key
  }
  // Fallback (floating point edge): return last key
  return entries[entries.length - 1][0]
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Choose which card a bot plays from its hand.
 *
 * - Conservative: play the artist with the highest perceived value (established)
 * - Aggressive: play the artist with the highest current-round count (trending)
 * - Erratic: pick randomly using the random seed
 *
 * When the chosen card is a 'double' auction type, prefer a non-double card
 * of the same artist if available (avoids getting stuck waiting for a partner).
 */
export function chooseBotCard(
  hand: Card[],
  game: GameState,
  personality: BotPersonality,
  random: number,
): Card {
  if (hand.length === 0) throw new Error('Bot hand is empty')

  let chosen: Card

  if (personality === 'erratic') {
    chosen = hand[Math.floor(random * hand.length)]
  } else if (personality === 'conservative') {
    // Sort by perceived value descending
    const sorted = [...hand].sort(
      (a, b) => perceiveArtistValue(b.artist, game) - perceiveArtistValue(a.artist, game),
    )
    chosen = sorted[0]
  } else {
    // Aggressive: sort by current round artist count descending (chase trending)
    const sorted = [...hand].sort(
      (a, b) => (game.artistCounts[b.artist] ?? 0) - (game.artistCounts[a.artist] ?? 0),
    )
    chosen = sorted[0]
  }

  // If chosen is a double, try to swap for a non-double of the same artist
  if (chosen.auctionType === 'double') {
    const alt = hand.find(
      c => c.artist === chosen.artist && c.auctionType !== 'double',
    )
    if (alt) chosen = alt
  }

  return chosen
}

/**
 * Decide a bot's bid for the current auction. Returns a numeric bid or
 * null (pass). Dispatches by auction type.
 *
 * Pure: all entropy via `random` (0-1).
 */
export function chooseBotBid(
  auction: AuctionState,
  game: GameState,
  personality: BotPersonality,
  money: number,
  random: number,
): number | null {
  const artist = auction.cards[0]?.artist
  if (!artist) return null

  const perceived = perceiveArtistValue(artist, game)
  const multiplier = BOT_CONFIG.valuationMultiplier[personality]
  const noiseRange = BOT_CONFIG.bidNoiseRange[personality]
  const passThresh = BOT_CONFIG.passThreshold[personality]
  const noise = (random - 0.5) * 2 * noiseRange * perceived

  switch (auction.auctionType) {
    case 'open': {
      const maxBid = perceived * multiplier
      const rawBid = auction.currentBid + 1000 + noise
      const bid = Math.floor(Math.max(rawBid, auction.currentBid + 1000))
      if (bid > money * passThresh) return null
      if (bid > maxBid && maxBid > 0) return null
      return bid
    }

    case 'once_around': {
      const rawBid = perceived * multiplier + noise
      const bid = Math.floor(rawBid)
      if (bid <= 0) return null
      if (bid > money * passThresh) return null
      return bid
    }

    case 'sealed_bid': {
      // Same as once_around but noise range doubled for wider variance
      const sealedNoise = (random - 0.5) * 2 * noiseRange * 2 * perceived
      const rawBid = perceived * multiplier + sealedNoise
      const bid = Math.floor(rawBid)
      if (bid <= 0) return null
      if (bid > money * passThresh) return null
      return bid
    }

    case 'fixed_price': {
      const fixedPrice = auction.fixedPrice
      if (fixedPrice === null) return null
      const threshold = perceived * multiplier * (1 + noise * 0.1)
      if (fixedPrice <= threshold) return fixedPrice
      return null
    }

    case 'double': {
      // Bots don't initiate bids on double auctions
      return null
    }

    default:
      return null
  }
}

/**
 * For a double auction in 'waiting_second' status, choose a matching card
 * from the bot's hand, or return null to pass.
 *
 * - Conservative prefers non-double type if multiple matches exist
 * - Erratic picks randomly among matches
 * - Aggressive takes the first match
 */
export function chooseBotSecondCard(
  hand: Card[],
  auction: AuctionState,
  personality: BotPersonality,
  random: number,
): Card | null {
  const targetArtist = auction.cards[0]?.artist
  if (!targetArtist) return null

  const matches = hand.filter(c => c.artist === targetArtist)
  if (matches.length === 0) return null

  if (personality === 'conservative') {
    // Prefer non-double type
    const nonDouble = matches.find(c => c.auctionType !== 'double')
    return nonDouble ?? matches[0]
  }

  if (personality === 'erratic') {
    return matches[Math.floor(random * matches.length)]
  }

  // Aggressive: first match
  return matches[0]
}

/**
 * Generate a sim-day slot plan for a bot. Returns SLOTS_PER_DAY TimeSlot
 * entries with types weighted by BOT_SLOT_WEIGHTS and neighborhoods from
 * BOT_NEIGHBORHOOD_PREFS.
 *
 * Uses a simple hash-chain on the random seed to derive per-slot entropy
 * without requiring multiple random parameters. Pure: no Math.random.
 */
export function chooseBotSlots(
  _playerSim: PlayerSimState,
  _game: GameState,
  personality: BotPersonality,
  random: number,
): TimeSlot[] {
  const weights = BOT_SLOT_WEIGHTS[personality]
  const neighborhoods = BOT_NEIGHBORHOOD_PREFS[personality]
  const slots: TimeSlot[] = []

  // Simple seeded PRNG (mulberry32-style) for per-slot entropy derivation.
  // Deterministic: same random seed produces same slots every time.
  let seed = Math.floor(random * 2147483647) + 1
  function nextRandom(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  for (let i = 0; i < SIM_CONFIG.SLOTS_PER_DAY; i++) {
    const slotRandom = nextRandom()
    const neighborhoodRandom = nextRandom()

    const slotType = weightedPick(weights as Record<SlotType, number>, slotRandom)
    const neighborhood = neighborhoods[Math.floor(neighborhoodRandom * neighborhoods.length)]

    slots.push({
      id: `bot-slot-${i}`,
      type: slotType,
      neighborhood,
    })
  }

  return slots
}

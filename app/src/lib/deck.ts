import type { Artist, AuctionType, Card } from '../types/game'

// Exact card distribution per artist (total 70 cards)
// Lite Metal: 12, Yoko: 13, Christine P: 14, Karl Gitter: 15, Krypto: 16
const DECK_DEF: Record<Artist, Record<AuctionType, number>> = {
  lite_metal:  { open: 3, once_around: 2, sealed_bid: 2, fixed_price: 2, double: 3 }, // 12
  yoko:        { open: 2, once_around: 3, sealed_bid: 3, fixed_price: 2, double: 3 }, // 13
  christine_p: { open: 3, once_around: 3, sealed_bid: 2, fixed_price: 3, double: 3 }, // 14
  karl_gitter: { open: 4, once_around: 3, sealed_bid: 2, fixed_price: 3, double: 3 }, // 15
  krypto:      { open: 4, once_around: 3, sealed_bid: 3, fixed_price: 3, double: 3 }, // 16
}

export function buildDeck(): Card[] {
  const cards: Card[] = []
  let counter = 0
  for (const [artist, types] of Object.entries(DECK_DEF) as [Artist, Record<AuctionType, number>][]) {
    for (const [auctionType, count] of Object.entries(types) as [AuctionType, number][]) {
      for (let i = 0; i < count; i++) {
        cards.push({ id: `${artist}_${auctionType}_${i}`, artist, auctionType })
        counter++
      }
    }
  }
  return cards
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function dealHands(deck: Card[], playerCount: number, round: number): { hands: Card[][]; remaining: Card[] } {
  const dist: Record<number, { initial: number; extra: number[] }> = {
    2: { initial: 10, extra: [6, 6, 0] },
    3: { initial: 10, extra: [6, 6, 0] },
    4: { initial: 9,  extra: [4, 4, 0] },
    5: { initial: 8,  extra: [3, 3, 0] },
  }
  const config = dist[playerCount] ?? dist[3]
  const perPlayer = round === 1 ? config.initial : config.extra[round - 2] ?? 0

  const remaining = [...deck]
  const hands: Card[][] = Array.from({ length: playerCount }, () => [])

  for (let i = 0; i < perPlayer; i++) {
    for (let p = 0; p < playerCount; p++) {
      const card = remaining.shift()
      if (card) hands[p].push(card)
    }
  }

  return { hands, remaining }
}

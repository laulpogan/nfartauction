import { describe, it, expect } from 'vitest'
import { buildDeck, dealHands, shuffle } from './deck'

describe('buildDeck', () => {
  it('produces exactly 70 cards', () => {
    expect(buildDeck()).toHaveLength(70)
  })

  it('distributes artists correctly (12/13/14/15/16)', () => {
    const deck = buildDeck()
    const counts: Record<string, number> = {}
    for (const card of deck) counts[card.artist] = (counts[card.artist] ?? 0) + 1
    expect(counts['lite_metal']).toBe(12)
    expect(counts['yoko']).toBe(13)
    expect(counts['christine_p']).toBe(14)
    expect(counts['karl_gitter']).toBe(15)
    expect(counts['krypto']).toBe(16)
  })

  it('gives every card a unique id', () => {
    const deck = buildDeck()
    const ids = deck.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('dealHands', () => {
  it('deals 10 cards per player in round 1 for 3 players', () => {
    const deck = buildDeck()
    const { hands, remaining } = dealHands(deck, 3, 1)
    expect(hands).toHaveLength(3)
    for (const hand of hands) expect(hand).toHaveLength(10)
    expect(remaining).toHaveLength(70 - 30)
  })

  it('deals 4 cards per player in round 2 for 4 players', () => {
    const deck = buildDeck()
    const { hands } = dealHands(deck, 4, 2)
    expect(hands).toHaveLength(4)
    for (const hand of hands) expect(hand).toHaveLength(4)
  })

  it('ensures no card appears in two hands', () => {
    const deck = buildDeck()
    const { hands } = dealHands(deck, 3, 1)
    const ids = hands.flat().map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('returns remaining deck preserving untouched cards', () => {
    const deck = buildDeck()
    const { hands, remaining } = dealHands(deck, 3, 1)
    const dealtIds = new Set(hands.flat().map(c => c.id))
    for (const card of remaining) {
      expect(dealtIds.has(card.id)).toBe(false)
    }
  })
})

describe('shuffle', () => {
  it('returns an array of the same length', () => {
    const deck = buildDeck()
    expect(shuffle(deck)).toHaveLength(deck.length)
  })

  it('contains the same set of cards as the input', () => {
    const deck = buildDeck()
    const shuffled = shuffle(deck)
    expect(new Set(shuffled.map(c => c.id))).toEqual(new Set(deck.map(c => c.id)))
  })

  it('does not mutate the original array', () => {
    const deck = buildDeck()
    const snapshot = deck.map(c => c.id)
    shuffle(deck)
    expect(deck.map(c => c.id)).toEqual(snapshot)
  })
})

import { describe, it, expect } from 'vitest'
import {
  resolveSlots,
  advanceDay,
  applyGlobalStatDrift,
  applySimModifiers,
  createInitialPlayerSimState,
  createInitialSimState,
} from './sim-engine'
import type { PlayerSimState, SimState, TimeSlot, PublicPlayer } from '../types/game'

// ─── Test fixtures ──────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    id: 'p0',
    sessionId: 's0',
    displayName: 'Test',
    position: 0,
    money: 100000,
    paintingCount: 0,
    paintings: [],
    isHost: true,
    coolness: 0,
    prestige: 0,
    ...overrides,
  }
}

function makeSim(overrides: Partial<PlayerSimState> = {}): PlayerSimState {
  return { ...createInitialPlayerSimState('s0'), ...overrides }
}

function makeGlobal(overrides: Partial<SimState> = {}): SimState {
  return { ...createInitialSimState(), ...overrides }
}

function slot(type: TimeSlot['type'], neighborhood: TimeSlot['neighborhood'] = null, id = 's'): TimeSlot {
  return { id, type, neighborhood }
}

// ─── resolveSlots ───────────────────────────────────────────────────────────

describe('resolveSlots', () => {
  it('returns player unchanged with empty events for empty slot list (timeout path)', () => {
    const playerSim = makeSim({ coolness: 25, restedness: 50, luck: 30 })
    const player = makePlayer({ money: 7777 })
    const r = resolveSlots(playerSim, [], makeGlobal(), player)
    expect(r.events).toEqual([])
    expect(r.updatedPlayerSim.coolness).toBe(25)
    expect(r.updatedPlayerSim.restedness).toBe(50)
    expect(r.updatedPlayerSim.luck).toBe(30)
    expect(r.updatedPlayerMoney).toBe(7777)
    // scheduledSlots is always cleared after resolution
    expect(r.updatedPlayerSim.scheduledSlots).toEqual([])
  })

  it('sleep slot bumps restedness by 25 and clamps to 100', () => {
    const playerSim = makeSim({ restedness: 90 })
    const player = makePlayer()
    const r = resolveSlots(playerSim, [slot('sleep')], makeGlobal(), player)
    expect(r.updatedPlayerSim.restedness).toBe(100) // clamped (90 + 25)
    expect(r.events).toHaveLength(1)
    expect(r.events[0].kind).toBe('slot:sleep')
  })

  it('gallery_work increases money by 3000', () => {
    const playerSim = makeSim()
    const player = makePlayer({ money: 1000 })
    const r = resolveSlots(playerSim, [slot('gallery_work')], makeGlobal(), player)
    expect(r.updatedPlayerMoney).toBe(4000)
    expect(r.events[0].statDeltas.money).toBe(3000)
  })

  it('clamps coolness floor at 0 even when slot would push it below', () => {
    // Three gallery_work slots each apply -1 coolness; starting at 2 should
    // floor at 0 and stay there.
    const playerSim = makeSim({ coolness: 2 })
    const player = makePlayer()
    const r = resolveSlots(
      playerSim,
      [slot('gallery_work', null, 'a'), slot('gallery_work', null, 'b'), slot('gallery_work', null, 'c')],
      makeGlobal(),
      player,
    )
    expect(r.updatedPlayerSim.coolness).toBe(0)
  })

  it('clamps coolness ceiling at 100', () => {
    const playerSim = makeSim({ coolness: 98 })
    const player = makePlayer()
    const r = resolveSlots(playerSim, [slot('opening')], makeGlobal(), player) // +5 coolness
    expect(r.updatedPlayerSim.coolness).toBe(100)
  })

  it('travel to a different neighborhood emits travel event and updates currentNeighborhood', () => {
    const playerSim = makeSim({ currentNeighborhood: 'gallery', restedness: 80 })
    const player = makePlayer()
    const r = resolveSlots(playerSim, [slot('opening', 'warehouse')], makeGlobal(), player)
    expect(r.updatedPlayerSim.currentNeighborhood).toBe('warehouse')
    const travelEvent = r.events.find(e => e.kind === 'travel')
    expect(travelEvent).toBeDefined()
    expect(travelEvent!.statDeltas.restedness).toBe(-5)
  })

  it('does NOT emit travel event when slot neighborhood matches current', () => {
    const playerSim = makeSim({ currentNeighborhood: 'gallery' })
    const player = makePlayer()
    const r = resolveSlots(playerSim, [slot('opening', 'gallery')], makeGlobal(), player)
    expect(r.events.find(e => e.kind === 'travel')).toBeUndefined()
  })

  it('money cannot go below 0 (floor clamp)', () => {
    const playerSim = makeSim()
    const player = makePlayer({ money: 500 })
    const r = resolveSlots(playerSim, [slot('art_fair')], makeGlobal(), player) // -2000 cost
    expect(r.updatedPlayerMoney).toBe(0)
  })

  it('clears scheduledSlots after resolution', () => {
    const playerSim = makeSim({ scheduledSlots: [slot('party')] })
    const player = makePlayer()
    const r = resolveSlots(playerSim, [slot('sleep')], makeGlobal(), player)
    expect(r.updatedPlayerSim.scheduledSlots).toEqual([])
  })
})

// ─── applyGlobalStatDrift ───────────────────────────────────────────────────

describe('applyGlobalStatDrift', () => {
  it('clamps hotness floor at 0.5', () => {
    const sim = makeGlobal({ artMarketHotness: 1.0 })
    const r = applyGlobalStatDrift(sim, { hotness: -10, gent: 0, nft: 0 })
    expect(r.artMarketHotness).toBe(0.5)
  })

  it('clamps hotness ceiling at 2.0', () => {
    const sim = makeGlobal({ artMarketHotness: 1.5 })
    const r = applyGlobalStatDrift(sim, { hotness: 10, gent: 0, nft: 0 })
    expect(r.artMarketHotness).toBe(2.0)
  })

  it('rounds gentrificationLevel to integer and clamps to [1, 10]', () => {
    const sim = makeGlobal({ gentrificationLevel: 5 })
    const r = applyGlobalStatDrift(sim, { hotness: 0, gent: 0.4, nft: 0 })
    expect(Number.isInteger(r.gentrificationLevel)).toBe(true)
    expect(r.gentrificationLevel).toBe(5)
    const r2 = applyGlobalStatDrift(sim, { hotness: 0, gent: 100, nft: 0 })
    expect(r2.gentrificationLevel).toBe(10)
    const r3 = applyGlobalStatDrift(sim, { hotness: 0, gent: -100, nft: 0 })
    expect(r3.gentrificationLevel).toBe(1)
  })

  it('clamps nftHypeCycle to [0, 100]', () => {
    const sim = makeGlobal({ nftHypeCycle: 95 })
    const r = applyGlobalStatDrift(sim, { hotness: 0, gent: 0, nft: 50 })
    expect(r.nftHypeCycle).toBe(100)
    const r2 = applyGlobalStatDrift(sim, { hotness: 0, gent: 0, nft: -200 })
    expect(r2.nftHypeCycle).toBe(0)
  })
})

// ─── advanceDay ─────────────────────────────────────────────────────────────

describe('advanceDay', () => {
  it('increments dayNumber by 1', () => {
    const sim = makeGlobal({ dayNumber: 3 })
    const { updatedSim } = advanceDay(sim, [])
    expect(updatedSim.dayNumber).toBe(4)
  })

  it('applies the provided drift to global stats', () => {
    const sim = makeGlobal({ artMarketHotness: 1.0, dayNumber: 0 })
    const { updatedSim } = advanceDay(sim, [], { hotness: 0.2, gent: 0, nft: 0 })
    expect(updatedSim.artMarketHotness).toBeCloseTo(1.2)
    expect(updatedSim.dayNumber).toBe(1)
  })

  it('passes player sims through unchanged (Phase 4 will mutate them)', () => {
    const a = makeSim({ sessionId: 'a' })
    const b = makeSim({ sessionId: 'b' })
    const { updatedPlayerSims } = advanceDay(makeGlobal(), [a, b])
    expect(updatedPlayerSims).toEqual([a, b])
  })
})

// ─── applySimModifiers ──────────────────────────────────────────────────────

describe('applySimModifiers', () => {
  it('returns deterministic shape with bidCeilingMultiplier and luckRoll', () => {
    const r = applySimModifiers(makePlayer(), makeSim(), makeGlobal())
    expect(r).toHaveProperty('bidCeilingMultiplier')
    expect(r).toHaveProperty('luckRoll')
    expect(typeof r.bidCeilingMultiplier).toBe('number')
    expect(typeof r.luckRoll).toBe('number')
  })

  it('reduces bidCeilingMultiplier when restedness < 30 (burnout penalty)', () => {
    const tired = makeSim({ restedness: 20, coolness: 0 })
    const fresh = makeSim({ restedness: 80, coolness: 0 })
    const sim = makeGlobal({ artMarketHotness: 1.0 })
    const tiredR = applySimModifiers(makePlayer(), tired, sim)
    const freshR = applySimModifiers(makePlayer(), fresh, sim)
    expect(tiredR.bidCeilingMultiplier).toBeLessThan(freshR.bidCeilingMultiplier)
    expect(tiredR.bidCeilingMultiplier).toBeCloseTo(0.85)
  })

  it('coolness scales bidCeilingMultiplier upward', () => {
    const dull = makeSim({ coolness: 0, restedness: 80 })
    const cool = makeSim({ coolness: 100, restedness: 80 })
    const sim = makeGlobal({ artMarketHotness: 1.0 })
    const r1 = applySimModifiers(makePlayer(), dull, sim)
    const r2 = applySimModifiers(makePlayer(), cool, sim)
    expect(r2.bidCeilingMultiplier).toBeGreaterThan(r1.bidCeilingMultiplier)
    expect(r2.bidCeilingMultiplier).toBeCloseTo(1.5)
  })

  it('luckRoll mirrors playerSim.luck', () => {
    const r = applySimModifiers(makePlayer(), makeSim({ luck: 73 }), makeGlobal())
    expect(r.luckRoll).toBe(73)
  })
})

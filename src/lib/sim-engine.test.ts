import { describe, it, expect } from 'vitest'
import {
  resolveSlots,
  advanceDay,
  applyGlobalStatDrift,
  applySimModifiers,
  createInitialPlayerSimState,
  createInitialSimState,
  decayRelationships,
  updateRelationship,
  deriveFactionAlignment,
  deriveBidLikelihoodModifiers,
  deriveCredibilityPenalty,
  seedDroppedArtist,
  progressLandlord,
  addDrugItem,
  removeDrugItem,
  applyDrugEffects,
  accumulateRisk,
  convertNft,
  purchaseNftWhitelist,
  applyNftHypeDrift,
  computeNftExchangeRate,
  computeFinalAppraisal,
  RELATIONSHIP_CONFIG,
  LANDLORD_CONFIG,
  LANDLORD_MESSAGES,
  DRUG_CONFIG,
  DRUG_DEFINITIONS,
  NFT_CONFIG,
  NFT_ITEM_DEFINITIONS,
} from './sim-engine'
import type {
  PlayerSimState,
  SimState,
  TimeSlot,
  PublicPlayer,
  Relationship,
  Artist,
} from '../types/game'

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

  it('decays relationships by default when no contact set is provided (Phase 4)', () => {
    const a = makeSim({ sessionId: 'a' })
    const b = makeSim({ sessionId: 'b' })
    const { updatedPlayerSims } = advanceDay(makeGlobal(), [a, b])
    // Non-relationship fields preserved
    expect(updatedPlayerSims[0].sessionId).toBe('a')
    expect(updatedPlayerSims[1].sessionId).toBe('b')
    expect(updatedPlayerSims[0].coolness).toBe(a.coolness)
    // Relationships decayed (no contacts)
    expect(updatedPlayerSims[0].relationships[0].score).toBeCloseTo(a.relationships[0].score * 0.85)
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

// ─── Phase 4 Plan 01: Relationship system ──────────────────────────────────

function makeRel(overrides: Partial<Relationship> = {}): Relationship {
  return {
    characterId: 'artist:lite_metal',
    kind: 'artist',
    displayName: 'Lite Metal',
    bio: 'test',
    factionAlignment: 'painters',
    score: 50,
    decayTimer: 0,
    isDroppedArtist: false,
    ...overrides,
  }
}

describe('decayRelationships', () => {
  it('leaves contacted relationships unchanged and ticks non-contacted ones by 0.85', () => {
    const rels: Relationship[] = [
      makeRel({ characterId: 'artist:yoko', score: 50 }),
      makeRel({ characterId: 'artist:krypto', score: 80 }),
    ]
    const out = decayRelationships(rels, new Set(['artist:yoko']), 1)
    expect(out[0].score).toBe(50) // contacted → unchanged
    expect(out[0].decayTimer).toBe(0)
    expect(out[1].score).toBeCloseTo(80 * 0.85)
    expect(out[1].decayTimer).toBe(1)
  })

  it('floors non-dropped score at 0 after repeated decay', () => {
    const rels = [makeRel({ score: 10 })]
    // One tick: still above the snap floor.
    const once = decayRelationships(rels, new Set(), 1)
    expect(once[0].score).toBeCloseTo(10 * 0.85)
    // After many ticks, the <1 snap floor zeroes it out.
    let cur = rels
    for (let i = 0; i < 50; i++) {
      cur = decayRelationships(cur, new Set(), i)
    }
    expect(cur[0].score).toBe(0)
  })

  it('dropped artist score is frozen at the seed value (-50) and does NOT decay', () => {
    const rels = [
      makeRel({ characterId: 'artist:lite_metal', score: -50, isDroppedArtist: true }),
    ]
    const out = decayRelationships(rels, new Set(), 1)
    expect(out[0].score).toBe(-50)
    expect(out[0].decayTimer).toBe(1) // timer still ticks
  })

  it('does not mutate the input array', () => {
    const rels = [makeRel({ score: 60 })]
    const out = decayRelationships(rels, new Set(), 1)
    expect(rels[0].score).toBe(60) // input untouched
    expect(out).not.toBe(rels)
  })
})

describe('updateRelationship', () => {
  it('clamps positive delta to a ceiling of 100', () => {
    const rels = [makeRel({ score: 95 })]
    const out = updateRelationship(rels, 'artist:lite_metal', 20)
    expect(out[0].score).toBe(100)
  })

  it('clamps negative delta to a floor of -50 (dropped range)', () => {
    const rels = [makeRel({ score: -40 })]
    const out = updateRelationship(rels, 'artist:lite_metal', -100)
    expect(out[0].score).toBe(-50)
  })

  it('returns input unchanged when characterId not found', () => {
    const rels = [makeRel({ score: 50 })]
    const out = updateRelationship(rels, 'collector:nobody', 10)
    expect(out).toBe(rels)
  })

  it('resets decayTimer on positive delta', () => {
    const rels = [makeRel({ score: 30, decayTimer: 5 })]
    const out = updateRelationship(rels, 'artist:lite_metal', 5)
    expect(out[0].decayTimer).toBe(0)
    expect(out[0].score).toBe(35)
  })
})

describe('deriveFactionAlignment', () => {
  it('sums positive scores by factionAlignment, excluding zero/negative', () => {
    const rels: Relationship[] = [
      makeRel({ characterId: 'a', score: 60, factionAlignment: 'painters' }),
      makeRel({ characterId: 'b', score: 40, factionAlignment: 'painters' }),
      makeRel({ characterId: 'c', score: 0, factionAlignment: 'sculptors' }),
      makeRel({ characterId: 'd', score: -50, factionAlignment: 'video_art', isDroppedArtist: true }),
      makeRel({ characterId: 'e', score: 20, factionAlignment: 'social_political' }),
    ]
    const f = deriveFactionAlignment(rels)
    expect(f.painters).toBe(100)
    expect(f.sculptors).toBe(0)
    expect(f.video_art).toBe(0)
    expect(f.social_political).toBe(20)
  })
})

describe('deriveBidLikelihoodModifiers', () => {
  it('returns 0 for neutral band (25 < score < 75)', () => {
    const out = deriveBidLikelihoodModifiers([makeRel({ score: 50 })])
    expect(out['artist:lite_metal']).toBe(0)
  })

  it('returns positive in [0.10, 0.15] for hot scores (≥75)', () => {
    const out = deriveBidLikelihoodModifiers([
      makeRel({ characterId: 'a', score: 75 }),
      makeRel({ characterId: 'b', score: 90 }),
      makeRel({ characterId: 'c', score: 100 }),
    ])
    expect(out.a).toBeCloseTo(0.10)
    expect(out.b).toBeGreaterThan(0.10)
    expect(out.b).toBeLessThan(0.15)
    expect(out.c).toBeCloseTo(0.15)
  })

  it('returns negative in [-0.15, -0.10] for cold scores (≤25)', () => {
    const out = deriveBidLikelihoodModifiers([
      makeRel({ characterId: 'a', score: 25 }),
      makeRel({ characterId: 'b', score: 10 }),
      makeRel({ characterId: 'c', score: 0 }),
    ])
    expect(out.a).toBeCloseTo(-0.10)
    expect(out.b).toBeLessThan(-0.10)
    expect(out.b).toBeGreaterThan(-0.15)
    expect(out.c).toBeCloseTo(-0.15)
  })

  it('returns -0.15 for dropped artist regardless of score', () => {
    const out = deriveBidLikelihoodModifiers([
      makeRel({ characterId: 'artist:lite_metal', score: -50, isDroppedArtist: true }),
    ])
    expect(out['artist:lite_metal']).toBeCloseTo(-RELATIONSHIP_CONFIG.bidModMaxAbs)
  })
})

describe('deriveCredibilityPenalty', () => {
  const zeroRoundValues: Record<Artist, number> = {
    lite_metal: 0, yoko: 0, christine_p: 0, karl_gitter: 0, krypto: 0,
  }

  it('returns 0 penalty when no dropped artist is set', () => {
    const rels = [makeRel({ score: 50 })]
    const r = deriveCredibilityPenalty(rels, zeroRoundValues)
    expect(r.penalty).toBe(0)
    expect(r.droppedArtist).toBeNull()
  })

  it('scales linearly with roundValues[droppedArtist]', () => {
    const rels = [makeRel({ characterId: 'artist:yoko', score: -50, isDroppedArtist: true, factionAlignment: 'social_political', displayName: 'Yoko' })]
    const rv: Record<Artist, number> = { ...zeroRoundValues, yoko: 20000 }
    const r = deriveCredibilityPenalty(rels, rv)
    expect(r.droppedArtist).toBe('yoko')
    expect(r.penalty).toBe(-Math.round(20000 * RELATIONSHIP_CONFIG.credibilityScale))
  })
})

describe('seedDroppedArtist', () => {
  it('marks the matching artist relationship with isDroppedArtist and seed score', () => {
    const ps = createInitialPlayerSimState('s0')
    const seeded = seedDroppedArtist(ps, 'krypto')
    const kr = seeded.relationships.find(r => r.characterId === 'artist:krypto')!
    expect(kr.isDroppedArtist).toBe(true)
    expect(kr.score).toBe(RELATIONSHIP_CONFIG.droppedSeedScore)
    expect(seeded.droppedArtist).toBe('krypto')
    // Other relationships untouched
    const others = seeded.relationships.filter(r => r.characterId !== 'artist:krypto')
    for (const o of others) {
      expect(o.isDroppedArtist).toBe(false)
      expect(o.score).toBe(RELATIONSHIP_CONFIG.initialScore)
    }
  })
})

describe('resolveSlots with targetCharacterId', () => {
  it('studio_visits with targetCharacterId bumps the relationship by +8 and adds to contactedThisDay', () => {
    const ps = createInitialPlayerSimState('s0')
    const player = makePlayer({ money: 100000 })
    const slots: TimeSlot[] = [
      { id: 'x', type: 'studio_visits', neighborhood: 'gallery', targetCharacterId: 'artist:lite_metal' },
    ]
    const r = resolveSlots(ps, slots, makeGlobal(), player)
    const lm = r.updatedPlayerSim.relationships.find(x => x.characterId === 'artist:lite_metal')!
    expect(lm.score).toBe(RELATIONSHIP_CONFIG.initialScore + 8)
    expect(r.contactedThisDay.has('artist:lite_metal')).toBe(true)
    expect(r.events.some(e => e.kind === 'relationship')).toBe(true)
  })

  it('art_fair with targetCharacterId applies a +12 bump', () => {
    const ps = createInitialPlayerSimState('s0')
    const player = makePlayer({ money: 100000 })
    const slots: TimeSlot[] = [
      { id: 'x', type: 'art_fair', neighborhood: 'gallery', targetCharacterId: 'collector:helena_v' },
    ]
    const r = resolveSlots(ps, slots, makeGlobal(), player)
    const h = r.updatedPlayerSim.relationships.find(x => x.characterId === 'collector:helena_v')!
    expect(h.score).toBe(RELATIONSHIP_CONFIG.initialScore + 12)
  })

  it('unknown targetCharacterId is a silent no-op (T-4-01 defense in depth)', () => {
    const ps = createInitialPlayerSimState('s0')
    const player = makePlayer({ money: 100000 })
    const slots: TimeSlot[] = [
      { id: 'x', type: 'opening', neighborhood: 'gallery', targetCharacterId: 'artist:fake_person' },
    ]
    const r = resolveSlots(ps, slots, makeGlobal(), player)
    expect(r.contactedThisDay.size).toBe(0)
    // No relationship event emitted for unknown ids
    expect(r.events.some(e => e.kind === 'relationship')).toBe(false)
  })

  it('gallery_work ignores targetCharacterId entirely (not a relationship slot)', () => {
    const ps = createInitialPlayerSimState('s0')
    const player = makePlayer({ money: 100000 })
    const slots: TimeSlot[] = [
      { id: 'x', type: 'gallery_work', neighborhood: 'gallery', targetCharacterId: 'artist:lite_metal' },
    ]
    const r = resolveSlots(ps, slots, makeGlobal(), player)
    const lm = r.updatedPlayerSim.relationships.find(x => x.characterId === 'artist:lite_metal')!
    expect(lm.score).toBe(RELATIONSHIP_CONFIG.initialScore) // unchanged
    expect(r.contactedThisDay.size).toBe(0)
  })
})

describe('advanceDay with contactedByPlayer', () => {
  it('decays relationships only for non-contacted characters per player', () => {
    const a = createInitialPlayerSimState('a')
    const b = createInitialPlayerSimState('b')
    const contacted = new Map<string, Set<string>>()
    contacted.set('a', new Set(['artist:lite_metal'])) // a contacted lite_metal
    contacted.set('b', new Set())                        // b contacted nobody
    const { updatedPlayerSims } = advanceDay(makeGlobal(), [a, b], undefined, contacted)
    const aLM = updatedPlayerSims[0].relationships.find(r => r.characterId === 'artist:lite_metal')!
    const bLM = updatedPlayerSims[1].relationships.find(r => r.characterId === 'artist:lite_metal')!
    expect(aLM.score).toBe(RELATIONSHIP_CONFIG.initialScore) // unchanged
    expect(bLM.score).toBeCloseTo(RELATIONSHIP_CONFIG.initialScore * 0.85)
  })

  it('treats missing contactedByPlayer as empty (all relationships decay)', () => {
    const a = createInitialPlayerSimState('a')
    const { updatedPlayerSims } = advanceDay(makeGlobal(), [a])
    const lm = updatedPlayerSims[0].relationships.find(r => r.characterId === 'artist:lite_metal')!
    expect(lm.score).toBeCloseTo(RELATIONSHIP_CONFIG.initialScore * 0.85)
  })
})

// ─── Phase 4 Plan 02: progressLandlord ─────────────────────────────────────

describe('progressLandlord', () => {
  it('advances stage 1 → 2 when prestige is below thresholds[0]', () => {
    const ps = createInitialPlayerSimState('s0')
    const r = progressLandlord(ps, 0)
    expect(r.advanced).toBe(true)
    expect(r.updatedPlayerSim.landlordStage).toBe(2)
    expect(r.updatedPlayerSim.seenLandlordStages).toEqual([1, 2])
  })

  it('does not advance when prestige meets or exceeds the threshold for the current stage', () => {
    const ps = createInitialPlayerSimState('s0')
    const r = progressLandlord(ps, LANDLORD_CONFIG.prestigeThresholds[0])
    expect(r.advanced).toBe(false)
    expect(r.updatedPlayerSim.landlordStage).toBe(1)
    expect(r.updatedPlayerSim.seenLandlordStages).toEqual([1])
  })

  it('stage 5 is terminal (no-op regardless of prestige)', () => {
    const ps: ReturnType<typeof createInitialPlayerSimState> = {
      ...createInitialPlayerSimState('s0'),
      landlordStage: 5,
      seenLandlordStages: [1, 2, 3, 4, 5],
    }
    const rLow = progressLandlord(ps, 0)
    const rHigh = progressLandlord(ps, 1_000)
    expect(rLow.advanced).toBe(false)
    expect(rLow.updatedPlayerSim.landlordStage).toBe(5)
    expect(rHigh.advanced).toBe(false)
    expect(rHigh.updatedPlayerSim.landlordStage).toBe(5)
  })

  it('monotonicity: high prestige at a mid stage cannot lower the stage', () => {
    const ps: ReturnType<typeof createInitialPlayerSimState> = {
      ...createInitialPlayerSimState('s0'),
      landlordStage: 3,
      seenLandlordStages: [1, 2, 3],
    }
    const r = progressLandlord(ps, 10_000)
    expect(r.updatedPlayerSim.landlordStage).toBe(3)
    expect(r.advanced).toBe(false)
  })

  it('all 5 stages reachable in 4 sequential calls when prestige stays at 0', () => {
    let ps = createInitialPlayerSimState('s0')
    for (let i = 0; i < 4; i++) {
      const r = progressLandlord(ps, 0)
      expect(r.advanced).toBe(true)
      ps = r.updatedPlayerSim
    }
    expect(ps.landlordStage).toBe(5)
    expect(ps.seenLandlordStages).toEqual([1, 2, 3, 4, 5])
    // A 5th call is a no-op terminal
    const r5 = progressLandlord(ps, 0)
    expect(r5.advanced).toBe(false)
    expect(r5.updatedPlayerSim.landlordStage).toBe(5)
  })

  it('stalls at stage 1 across many days when prestige stays high', () => {
    let ps = createInitialPlayerSimState('s0')
    for (let i = 0; i < 10; i++) {
      const r = progressLandlord(ps, 10_000)
      expect(r.advanced).toBe(false)
      ps = r.updatedPlayerSim
    }
    expect(ps.landlordStage).toBe(1)
    expect(ps.seenLandlordStages).toEqual([1])
  })

  it('does not mutate the input playerSim (purity)', () => {
    const ps = createInitialPlayerSimState('s0')
    const snapshot = JSON.parse(JSON.stringify(ps))
    progressLandlord(ps, 0)
    expect(ps).toEqual(snapshot)
  })

  it('all 5 landlord messages are authored non-empty strings', () => {
    for (const stage of [1, 2, 3, 4, 5] as const) {
      expect(typeof LANDLORD_MESSAGES[stage]).toBe('string')
      expect(LANDLORD_MESSAGES[stage].length).toBeGreaterThan(0)
    }
  })
})

// ─── Phase 4 Plan 03: drug system ──────────────────────────────────────────

describe('addDrugItem', () => {
  it('appends an item with display strings sourced from DRUG_DEFINITIONS', () => {
    const ps = createInitialPlayerSimState('s0')
    const next = addDrugItem(ps, 'coke', 'drug-1')
    expect(next.drugs.length).toBe(1)
    expect(next.drugs[0].id).toBe('drug-1')
    expect(next.drugs[0].kind).toBe('coke')
    expect(next.drugs[0].displayLabel).toBe(DRUG_DEFINITIONS.coke.displayLabel)
    expect(next.drugs[0].displayMeta).toBe(DRUG_DEFINITIONS.coke.displayMeta)
  })

  it('does not mutate input playerSim', () => {
    const ps = createInitialPlayerSimState('s0')
    const snapshot = JSON.parse(JSON.stringify(ps))
    addDrugItem(ps, 'mdma', 'drug-x')
    expect(ps).toEqual(snapshot)
  })
})

describe('removeDrugItem', () => {
  it('removes by id', () => {
    let ps = createInitialPlayerSimState('s0')
    ps = addDrugItem(ps, 'coke', 'drug-1')
    ps = addDrugItem(ps, 'mdma', 'drug-2')
    const next = removeDrugItem(ps, 'drug-1')
    expect(next.drugs.length).toBe(1)
    expect(next.drugs[0].id).toBe('drug-2')
  })

  it('no-op when id is missing', () => {
    let ps = createInitialPlayerSimState('s0')
    ps = addDrugItem(ps, 'coke', 'drug-1')
    const next = removeDrugItem(ps, 'nonexistent')
    expect(next.drugs.length).toBe(1)
    expect(next.drugs[0].id).toBe('drug-1')
  })
})

describe('applyDrugEffects', () => {
  it('applies coke coolness and restedness deltas', () => {
    const ps = { ...createInitialPlayerSimState('s0'), coolness: 20, restedness: 80 }
    const { updatedPlayerSim, statDeltas } = applyDrugEffects(ps, 'coke')
    expect(updatedPlayerSim.coolness).toBe(20 + DRUG_DEFINITIONS.coke.coolness)
    expect(updatedPlayerSim.restedness).toBe(80 + DRUG_DEFINITIONS.coke.restedness)
    expect(statDeltas.coolness).toBe(DRUG_DEFINITIONS.coke.coolness)
    expect(statDeltas.restedness).toBe(DRUG_DEFINITIONS.coke.restedness)
  })

  it('clamps coolness at 100 and restedness at 0', () => {
    const ps = { ...createInitialPlayerSimState('s0'), coolness: 99, restedness: 5 }
    const { updatedPlayerSim } = applyDrugEffects(ps, 'mdma')
    expect(updatedPlayerSim.coolness).toBe(100)
    expect(updatedPlayerSim.restedness).toBe(0)
  })

  it('does not mutate input playerSim', () => {
    const ps = createInitialPlayerSimState('s0')
    const snapshot = JSON.parse(JSON.stringify(ps))
    applyDrugEffects(ps, 'coke')
    expect(ps).toEqual(snapshot)
  })
})

describe('accumulateRisk', () => {
  function psWithDrugs(n: number): PlayerSimState {
    let ps = createInitialPlayerSimState('s0')
    for (let i = 0; i < n; i++) ps = addDrugItem(ps, 'coke', `d-${i}`)
    return ps
  }

  it('increments risk when drugs.length is strictly greater than threshold', () => {
    const ps = psWithDrugs(DRUG_CONFIG.riskThreshold + 1)
    const next = accumulateRisk(ps)
    expect(next.risk).toBe(DRUG_CONFIG.riskPerDay)
  })

  it('no change at exactly the threshold', () => {
    const ps = { ...psWithDrugs(DRUG_CONFIG.riskThreshold), risk: 20 }
    const next = accumulateRisk(ps)
    expect(next.risk).toBe(20)
  })

  it('clamps risk to 100', () => {
    const ps = { ...psWithDrugs(DRUG_CONFIG.riskThreshold + 3), risk: 98 }
    const next = accumulateRisk(ps)
    expect(next.risk).toBe(100)
  })

  it('decays by 1 when inventory is empty, with a floor of 0', () => {
    const ps = { ...createInitialPlayerSimState('s0'), risk: 5 }
    const next = accumulateRisk(ps)
    expect(next.risk).toBe(4)

    const clean = { ...createInitialPlayerSimState('s0'), risk: 0 }
    expect(accumulateRisk(clean).risk).toBe(0)
  })

  it('does not mutate input playerSim', () => {
    const ps = { ...psWithDrugs(DRUG_CONFIG.riskThreshold + 1), risk: 10 }
    const snapshot = JSON.parse(JSON.stringify(ps))
    accumulateRisk(ps)
    expect(ps).toEqual(snapshot)
  })
})

// ─── Phase 5 Plan 01: NFT system ───────────────────────────────────────────

describe('NFT system', () => {
  describe('computeNftExchangeRate', () => {
    it('returns 0.5 at hype 0', () => {
      expect(computeNftExchangeRate(0)).toBeCloseTo(0.5)
    })
    it('returns 1.25 at hype 50', () => {
      expect(computeNftExchangeRate(50)).toBeCloseTo(1.25)
    })
    it('returns 2.0 at hype 100', () => {
      expect(computeNftExchangeRate(100)).toBeCloseTo(2.0)
    })
  })

  describe('applyNftHypeDrift', () => {
    it('applies a positive delta', () => {
      expect(applyNftHypeDrift(40, 7)).toBe(47)
    })
    it('clamps at 100 on overshoot', () => {
      expect(applyNftHypeDrift(95, 20)).toBe(100)
    })
    it('clamps at 0 on undershoot', () => {
      expect(applyNftHypeDrift(5, -20)).toBe(0)
    })
  })

  describe('convertNft', () => {
    it('debits nftWallet and returns floor(amount * rate) as moneyDelta', () => {
      const ps = { ...createInitialPlayerSimState('s0'), nftWallet: 5 }
      const { updatedPlayerSim, moneyDelta } = convertNft(ps, 4, 1.25)
      expect(updatedPlayerSim.nftWallet).toBe(1)
      expect(moneyDelta).toBe(5) // floor(4 * 1.25) = 5
    })

    it('rejects on overdraft (amount > nftWallet)', () => {
      const ps = { ...createInitialPlayerSimState('s0'), nftWallet: 3 }
      const { updatedPlayerSim, moneyDelta } = convertNft(ps, 5, 1.0)
      expect(updatedPlayerSim).toBe(ps)
      expect(moneyDelta).toBe(0)
    })

    it('rejects on amount = 0', () => {
      const ps = { ...createInitialPlayerSimState('s0'), nftWallet: 5 }
      const { updatedPlayerSim, moneyDelta } = convertNft(ps, 0, 2.0)
      expect(updatedPlayerSim).toBe(ps)
      expect(moneyDelta).toBe(0)
    })

    it('rejects on negative amount', () => {
      const ps = { ...createInitialPlayerSimState('s0'), nftWallet: 5 }
      const { moneyDelta } = convertNft(ps, -3, 2.0)
      expect(moneyDelta).toBe(0)
    })

    it('does not mutate input playerSim', () => {
      const ps = { ...createInitialPlayerSimState('s0'), nftWallet: 5 }
      const snapshot = JSON.parse(JSON.stringify(ps))
      convertNft(ps, 2, 1.5)
      expect(ps).toEqual(snapshot)
    })
  })

  describe('purchaseNftWhitelist', () => {
    it('debits whitelistCost and appends item on a hit', () => {
      const ps = { ...createInitialPlayerSimState('s0'), nftWallet: 5 }
      const def = NFT_ITEM_DEFINITIONS.rare
      const item = {
        id: 'nft-1',
        rarity: 'rare' as const,
        displayLabel: def.displayLabel,
        displayMeta: def.displayMeta,
        baseValue: def.baseValue,
      }
      const next = purchaseNftWhitelist(ps, item)
      expect(next.nftWallet).toBe(5 - NFT_CONFIG.whitelistCost)
      expect(next.heldNfts.length).toBe(1)
      expect(next.heldNfts[0].id).toBe('nft-1')
    })

    it('debits whitelistCost without appending on a miss (item=null)', () => {
      const ps = { ...createInitialPlayerSimState('s0'), nftWallet: 5 }
      const next = purchaseNftWhitelist(ps, null)
      expect(next.nftWallet).toBe(5 - NFT_CONFIG.whitelistCost)
      expect(next.heldNfts.length).toBe(0)
    })

    it('returns input unchanged when nftWallet < whitelistCost', () => {
      const ps = { ...createInitialPlayerSimState('s0'), nftWallet: 1 }
      const next = purchaseNftWhitelist(ps, null)
      expect(next).toBe(ps)
    })

    it('does not mutate input playerSim', () => {
      const ps = { ...createInitialPlayerSimState('s0'), nftWallet: 5 }
      const snapshot = JSON.parse(JSON.stringify(ps))
      purchaseNftWhitelist(ps, null)
      expect(ps).toEqual(snapshot)
    })
  })
})

// ─── Phase 5 Plan 02: End-state appraisal ─────────────────────────────────

describe('End-state appraisal', () => {
  function makeAppraisalSim(overrides: Partial<PlayerSimState> = {}): PlayerSimState {
    return { ...createInitialPlayerSimState('s0'), ...overrides }
  }

  it('returns a FinalAppraisal with all top-level fields populated', () => {
    const ps = makeAppraisalSim()
    const out = computeFinalAppraisal({
      sessionId: 's0',
      displayName: 'Alice',
      finalMoney: 12345,
      playerSim: ps,
      neighborhoodHistory: ['gallery'],
    })
    expect(out.sessionId).toBe('s0')
    expect(out.displayName).toBe('Alice')
    expect(out.finalMoney).toBe(12345)
    expect(out.factionMix).toBeDefined()
    expect(out.neighborhoodsVisited).toEqual(['gallery'])
    expect(out.roundsInFlatlands).toBe(0)
    expect(out.nftExposure).toBeDefined()
    expect(out.keyRelationships).toHaveLength(3)
    expect(typeof out.threeSentenceEpitaph).toBe('string')
  })

  it('selects dominantFaction as the argmax over factionMix', () => {
    // Boost painters by updating Helena V. (painters collector) to 100.
    let relationships = createInitialPlayerSimState('s0').relationships
    relationships = updateRelationship(relationships, 'collector:helena_v', 50)
    const ps = makeAppraisalSim({ relationships })
    const out = computeFinalAppraisal({
      sessionId: 's0',
      displayName: 'Alice',
      finalMoney: 0,
      playerSim: ps,
      neighborhoodHistory: [],
    })
    expect(out.dominantFaction).toBe('painters')
  })

  it('returns null dominantFaction when all faction totals are zero', () => {
    // Zero out every relationship score so factionMix is all zeros.
    const relationships = createInitialPlayerSimState('s0').relationships.map(r => ({
      ...r,
      score: 0,
    }))
    const ps = makeAppraisalSim({ relationships })
    const out = computeFinalAppraisal({
      sessionId: 's0',
      displayName: 'Alice',
      finalMoney: 0,
      playerSim: ps,
      neighborhoodHistory: [],
    })
    expect(out.dominantFaction).toBeNull()
  })

  it('dedupes neighborhoodsVisited preserving first-seen order', () => {
    const ps = makeAppraisalSim()
    const out = computeFinalAppraisal({
      sessionId: 's0',
      displayName: 'Alice',
      finalMoney: 0,
      playerSim: ps,
      neighborhoodHistory: ['gallery', 'flatlands', 'gallery', 'warehouse', 'flatlands'],
    })
    expect(out.neighborhoodsVisited).toEqual(['gallery', 'flatlands', 'warehouse'])
  })

  it('counts roundsInFlatlands across the history', () => {
    const ps = makeAppraisalSim()
    const out = computeFinalAppraisal({
      sessionId: 's0',
      displayName: 'Alice',
      finalMoney: 0,
      playerSim: ps,
      neighborhoodHistory: ['flatlands', 'gallery', 'flatlands', 'flatlands', 'hotel'],
    })
    expect(out.roundsInFlatlands).toBe(3)
  })

  it('sorts keyRelationships by absolute score and maps status correctly', () => {
    // Craft 3 relationships: one kept (score 80), one cold (score 10),
    // one dropped (score -50 via isDroppedArtist seed).
    let relationships = createInitialPlayerSimState('s0').relationships.map(r => ({
      ...r,
      score: 0,
    }))
    relationships = updateRelationship(relationships, 'collector:helena_v', 80)
    relationships = updateRelationship(relationships, 'collector:bram_k', 10)
    relationships = relationships.map(r =>
      r.characterId === 'artist:lite_metal'
        ? { ...r, score: RELATIONSHIP_CONFIG.droppedSeedScore, isDroppedArtist: true }
        : r,
    )
    const ps = makeAppraisalSim({ relationships })
    const out = computeFinalAppraisal({
      sessionId: 's0',
      displayName: 'Alice',
      finalMoney: 0,
      playerSim: ps,
      neighborhoodHistory: [],
    })
    expect(out.keyRelationships).toHaveLength(3)
    // First is abs-highest; dropped artist at -50 beats 80? abs(80)=80, abs(-50)=50
    // So Helena (80) first, lite_metal (-50) second, Bram (10) third.
    expect(out.keyRelationships[0].score).toBe(80)
    expect(out.keyRelationships[0].status).toBe('kept')
    expect(out.keyRelationships[1].score).toBe(-50)
    expect(out.keyRelationships[1].status).toBe('dropped')
    expect(out.keyRelationships[2].score).toBe(10)
    expect(out.keyRelationships[2].status).toBe('cold')
  })

  it('passes through nftExposure from playerSim', () => {
    const item: import('../types/game').NftItem = {
      id: 'n1',
      rarity: 'rare',
      displayLabel: 'L',
      displayMeta: 'M',
      baseValue: 10,
    }
    const ps = makeAppraisalSim({
      nftWallet: 7,
      nftWalletUnlocked: true,
      heldNfts: [item, item, item],
    })
    const out = computeFinalAppraisal({
      sessionId: 's0',
      displayName: 'Alice',
      finalMoney: 0,
      playerSim: ps,
      neighborhoodHistory: [],
    })
    expect(out.nftExposure).toEqual({ heldCount: 3, walletBalance: 7, unlocked: true })
  })

  it('produces an epitaph with exactly three sentences ending in a period', () => {
    const ps = makeAppraisalSim()
    const out = computeFinalAppraisal({
      sessionId: 's0',
      displayName: 'Alice',
      finalMoney: 0,
      playerSim: ps,
      neighborhoodHistory: [],
    })
    // Count sentences by trailing-period segments. Our templates end each
    // clause with a single period, so splitting on '. ' should give 3 parts.
    const trimmed = out.threeSentenceEpitaph.trim()
    expect(trimmed.endsWith('.')).toBe(true)
    const segments = trimmed.split(/\. (?=[a-z{])/)
    expect(segments.length).toBe(3)
  })

  it('epitaph reflects the selected clause keys (deep_chain + flatlands_native)', () => {
    const item: import('../types/game').NftItem = {
      id: 'n1',
      rarity: 'legendary',
      displayLabel: 'L',
      displayMeta: 'M',
      baseValue: 25,
    }
    const ps = makeAppraisalSim({ heldNfts: [item, item, item, item] })
    const out = computeFinalAppraisal({
      sessionId: 's0',
      displayName: 'Alice',
      finalMoney: 0,
      playerSim: ps,
      neighborhoodHistory: ['flatlands', 'flatlands', 'flatlands', 'flatlands'],
    })
    // deep_chain template[0]: 'the chain position grew into a second inventory.'
    expect(out.threeSentenceEpitaph).toContain('chain position grew')
    // flatlands_native template[0]: 'the flatlands kept appearing in the travel log...'
    expect(out.threeSentenceEpitaph).toContain('flatlands kept appearing')
  })

  it('epitaph interpolates {name} for templates that include it (sculptors dominant)', () => {
    // Make sculptors dominant: Bram K is a sculptor collector (score 50);
    // zero everyone else so Bram wins.
    const relationships = createInitialPlayerSimState('s0').relationships.map(r =>
      r.characterId === 'collector:bram_k' ? r : { ...r, score: 0 },
    )
    const ps = makeAppraisalSim({ relationships })
    const out = computeFinalAppraisal({
      sessionId: 's0',
      displayName: 'Margot',
      finalMoney: 0,
      playerSim: ps,
      neighborhoodHistory: [],
    })
    // sculptors template[0] contains {name}: 'Margot kept the sculptors close...'
    expect(out.threeSentenceEpitaph).toContain('Margot')
  })

  it('is pure: does not mutate playerSim or neighborhoodHistory', () => {
    const ps = makeAppraisalSim({ nftWallet: 3 })
    const history: import('../types/game').Neighborhood[] = ['gallery', 'flatlands']
    const psSnapshot = JSON.parse(JSON.stringify(ps))
    const historySnapshot = [...history]
    computeFinalAppraisal({
      sessionId: 's0',
      displayName: 'Alice',
      finalMoney: 0,
      playerSim: ps,
      neighborhoodHistory: history,
    })
    expect(ps).toEqual(psSnapshot)
    expect(history).toEqual(historySnapshot)
  })
})

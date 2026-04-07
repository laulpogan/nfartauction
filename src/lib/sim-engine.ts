// ─── Phase 3: Sim Engine ────────────────────────────────────────────────────
//
// Pure functional core for the gallery sim layer. Mirrors the engine.ts
// pattern: state-in / state-out, no side effects, no Math.random, no Date.now,
// no console. Determinism is maintained by accepting drift values as
// parameters (the server is responsible for sourcing entropy).
//
// Functions:
//   resolveSlots         — apply a player's day plan to their PlayerSimState
//                          and money, emitting per-slot SimEvents
//   advanceDay           — increment dayNumber and apply global stat drift
//   applyGlobalStatDrift — pure projection of drift onto SimState (clamped)
//   applySimModifiers    — derive auction-time modifiers from sim state
//   progressLandlord     — Phase 4 Plan 02: advance landlord arc per sim_day
//
// All numeric stats (coolness, restedness, luck) are clamped to [0, 100].
// Money is clamped to a floor of 0 (defense in depth on top of Zod input
// validation in 03-02).

import type {
  PlayerSimState,
  SimState,
  TimeSlot,
  SimEvent,
  PublicPlayer,
  Relationship,
  Faction,
  Artist,
  LandlordStage,
  DrugItem,
  DrugItemKind,
  PlayerStats,
} from '../types/game'
import {
  SLOT_DEFINITIONS,
  SIM_CONFIG,
  RELATIONSHIP_CONFIG,
  LANDLORD_CONFIG,
  DRUG_CONFIG,
  DRUG_DEFINITIONS,
} from './sim-config'

export interface ResolveSlotsResult {
  updatedPlayerSim: PlayerSimState
  updatedPlayerMoney: number
  events: SimEvent[]
  /** Character IDs contacted during this slot plan. Server feeds this into advanceDay → decayRelationships. */
  contactedThisDay: Set<string>
}

/** Slot types that can carry a targetCharacterId and produce a relationship contact. */
const RELATIONSHIP_SLOT_DELTAS: Partial<Record<TimeSlot['type'], number>> = {
  studio_visits: 8,
  opening: 8,
  art_fair: 12,
}

/**
 * Apply a player's submitted slot plan to their sim state and money.
 * Pure: same input → same output. Empty `slots` returns the player unchanged
 * with no events (the timeout-with-no-submission path).
 */
export function resolveSlots(
  playerSim: PlayerSimState,
  slots: TimeSlot[],
  _publicSim: SimState,
  player: PublicPlayer,
): ResolveSlotsResult {
  let coolness = playerSim.coolness
  let restedness = playerSim.restedness
  let luck = playerSim.luck
  let money = player.money
  let currentNeighborhood = playerSim.currentNeighborhood
  let relationships = playerSim.relationships
  const events: SimEvent[] = []
  const contactedThisDay = new Set<string>()

  for (const slot of slots) {
    // Travel resolution: if slot has a target neighborhood and it differs
    // from current, treat travel as a side effect of the slot (consumes a
    // restedness cost separate from the slot's own deltas, and emits a
    // distinct travel event so the receipt can show it).
    if (slot.neighborhood && slot.neighborhood !== currentNeighborhood) {
      const beforeRest = restedness
      restedness = clamp(restedness - 5, 0, 100)
      events.push({
        kind: 'travel',
        description: `travel ${currentNeighborhood} → ${slot.neighborhood}`,
        statDeltas: { restedness: restedness - beforeRest },
      })
      currentNeighborhood = slot.neighborhood
    }

    const def = SLOT_DEFINITIONS[slot.type]
    if (!def) {
      // T-3-02: defensive guard. If an unknown slot.type slips past Zod,
      // skip it rather than crash. The test suite covers the happy path;
      // this branch keeps resolveSlots total over its input domain.
      continue
    }

    const beforeMoney = money
    const beforeCool = coolness
    const beforeRest = restedness
    const beforeLuck = luck

    money = Math.max(0, money + def.money)
    coolness = clamp(coolness + def.coolness, 0, 100)
    restedness = clamp(restedness + def.restedness, 0, 100)
    luck = clamp(luck + def.luck, 0, 100)

    events.push({
      kind: `slot:${slot.type}`,
      description: def.description,
      statDeltas: {
        money: money - beforeMoney,
        coolness: coolness - beforeCool,
        restedness: restedness - beforeRest,
        luck: luck - beforeLuck,
      },
    })

    // Phase 4 Plan 01: relationship contact path. Only honored for the three
    // slot types in RELATIONSHIP_SLOT_DELTAS; other slot types silently
    // ignore targetCharacterId (T-4-01 defense-in-depth, plus Zod already
    // validates the string shape at the server boundary).
    const relDelta = RELATIONSHIP_SLOT_DELTAS[slot.type]
    if (relDelta !== undefined && slot.targetCharacterId) {
      const before = relationships.find(r => r.characterId === slot.targetCharacterId)
      if (before) {
        relationships = updateRelationship(relationships, slot.targetCharacterId, relDelta)
        contactedThisDay.add(slot.targetCharacterId)
        events.push({
          kind: 'relationship',
          description: `contact ${before.displayName} (+${relDelta})`,
          statDeltas: {},
        })
      }
    }
  }

  return {
    updatedPlayerSim: {
      ...playerSim,
      coolness,
      restedness,
      luck,
      currentNeighborhood,
      relationships,
      // Clear scheduledSlots — the day's plan has been executed.
      scheduledSlots: [],
    },
    updatedPlayerMoney: money,
    events,
    contactedThisDay,
  }
}

/**
 * Apply explicit drift to global SimState. Pure: callers (server) are
 * responsible for sourcing the drift values from a deterministic source
 * (seeded RNG) so tests can pass exact deltas.
 */
export function applyGlobalStatDrift(
  sim: SimState,
  drift: { hotness: number; gent: number; nft: number },
): SimState {
  return {
    ...sim,
    artMarketHotness: clamp(sim.artMarketHotness + drift.hotness, 0.5, 2.0),
    gentrificationLevel: Math.round(clamp(sim.gentrificationLevel + drift.gent, 1, 10)),
    nftHypeCycle: clamp(sim.nftHypeCycle + drift.nft, 0, 100),
  }
}

/**
 * Advance the sim by one day. Increments dayNumber and applies the supplied
 * global stat drift. Phase 4 will add relationship decay and landlord ticks
 * here; for now `allPlayerSims` is passed through unchanged.
 */
export function advanceDay(
  sim: SimState,
  allPlayerSims: PlayerSimState[],
  drift: { hotness: number; gent: number; nft: number } = { hotness: 0, gent: 0, nft: 0 },
  contactedByPlayer?: Map<string, Set<string>>,
): { updatedSim: SimState; updatedPlayerSims: PlayerSimState[] } {
  const drifted = applyGlobalStatDrift(sim, drift)
  const updatedSim: SimState = {
    ...drifted,
    dayNumber: sim.dayNumber + 1,
  }
  // Phase 4 Plan 01: decay relationships per player. The server owns the
  // contacted set derived from that day's resolveSlots return value. If the
  // map is not provided (legacy callers / tests), treat every player's
  // contact set as empty — which decays everything, consistent with the
  // "nobody got called today" path.
  const updatedPlayerSims = allPlayerSims.map(ps => {
    const contacted = contactedByPlayer?.get(ps.sessionId) ?? new Set<string>()
    return {
      ...ps,
      relationships: decayRelationships(ps.relationships, contacted, updatedSim.dayNumber),
    }
  })
  return { updatedSim, updatedPlayerSims }
}

// ─── Phase 4 Plan 01: Relationship pure functions ──────────────────────────

/**
 * Apply exponential decay to all relationships NOT in the contacted set.
 * Contacted relationships are left unchanged here — the positive-delta path
 * is updateRelationship, called inside resolveSlots per slot contact event.
 *
 * Pure: returns a new array; never mutates input.
 *
 * Invariants:
 *  - Non-contacted, non-dropped: score = max(0, score * decayFactor); decayTimer += 1
 *  - Non-contacted, dropped artist: score is frozen at droppedSeedScore (-50);
 *    decayTimer still ticks (so contact recency is visible).
 *  - Contacted: unchanged in-place (updateRelationship is the write path).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function decayRelationships(
  relationships: Relationship[],
  contactedIds: Set<string>,
  _currentDay: number,
): Relationship[] {
  return relationships.map(r => {
    if (contactedIds.has(r.characterId)) return r
    if (r.isDroppedArtist) {
      // Dropped artist score is locked at the seed value until a positive
      // contact is made (via updateRelationship). Decay timer still ticks.
      return { ...r, decayTimer: r.decayTimer + 1 }
    }
    // Exponential decay with a hard floor: once score drops below 1, snap
    // to 0 so the relationship is visibly dead (otherwise 0.85^n asymptotes).
    const decayed = r.score * RELATIONSHIP_CONFIG.decayFactor
    const next = decayed < 1 ? 0 : decayed
    return { ...r, score: next, decayTimer: r.decayTimer + 1 }
  })
}

/**
 * Apply a delta to a single relationship score, clamped to [-50, 100].
 * Unknown characterIds return the input array unchanged (T-4-01: defense
 * against client-supplied slot.targetCharacterId that doesn't match any
 * real relationship). Positive deltas reset decayTimer to 0.
 */
export function updateRelationship(
  relationships: Relationship[],
  characterId: string,
  scoreDelta: number,
): Relationship[] {
  const idx = relationships.findIndex(r => r.characterId === characterId)
  if (idx === -1) return relationships
  const current = relationships[idx]
  const nextScore = clamp(
    current.score + scoreDelta,
    RELATIONSHIP_CONFIG.droppedSeedScore,
    100,
  )
  const nextTimer = scoreDelta > 0 ? 0 : current.decayTimer
  const next: Relationship = { ...current, score: nextScore, decayTimer: nextTimer }
  const out = relationships.slice()
  out[idx] = next
  return out
}

/**
 * Derive faction alignment as a positive-score aggregation. Negative scores
 * (including the dropped artist) are excluded — a player doesn't "gain"
 * painters alignment from hating a painter. Pure: no state stored.
 */
export function deriveFactionAlignment(
  relationships: Relationship[],
): Record<Faction, number> {
  const totals: Record<Faction, number> = {
    painters: 0,
    sculptors: 0,
    video_art: 0,
    social_political: 0,
  }
  for (const r of relationships) {
    if (r.score <= 0) continue
    totals[r.factionAlignment] += r.score
  }
  return totals
}

/**
 * Project each relationship into a bid-likelihood modifier in [-0.15, +0.15].
 *  - score ≥ 75: +0.10 → +0.15 linear from 75 to 100
 *  - score ≤ 25 (cold, non-dropped): -0.10 → -0.15 linear from 25 to 0
 *  - isDroppedArtist: always -0.15
 *  - else: 0 (neutral band 25 < score < 75)
 *
 * The auction layer keys into this by characterId ('artist:<artistId>') to
 * look up a per-artist bid-behavior tweak.
 */
export function deriveBidLikelihoodModifiers(
  relationships: Relationship[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of relationships) {
    if (r.isDroppedArtist) {
      out[r.characterId] = -RELATIONSHIP_CONFIG.bidModMaxAbs
      continue
    }
    if (r.score >= 75) {
      // 75 → 0.10, 100 → 0.15
      const t = (r.score - 75) / 25 // 0..1
      out[r.characterId] = 0.10 + t * 0.05
    } else if (r.score <= 25 && r.score >= 0) {
      // 25 → -0.10, 0 → -0.15
      const t = (25 - r.score) / 25 // 0..1
      out[r.characterId] = -(0.10 + t * 0.05)
    } else {
      out[r.characterId] = 0
    }
  }
  return out
}

/**
 * Credibility penalty from "the artist you shouldn't have dropped". The
 * penalty is -round(roundValues[droppedArtist] * credibilityScale) so it
 * scales with the dropped artist's cumulative market value over the game.
 * Returns { penalty: 0, droppedArtist: null } when no dropped artist is set.
 */
export function deriveCredibilityPenalty(
  relationships: Relationship[],
  roundValues: Record<Artist, number>,
): { penalty: number; droppedArtist: Artist | null } {
  const dropped = relationships.find(r => r.isDroppedArtist && r.kind === 'artist')
  if (!dropped) return { penalty: 0, droppedArtist: null }
  // characterId for artists is 'artist:<artistId>'; strip the prefix.
  const artist = dropped.characterId.replace(/^artist:/, '') as Artist
  const marketValue = roundValues[artist] ?? 0
  const penalty = -Math.round(marketValue * RELATIONSHIP_CONFIG.credibilityScale)
  return { penalty, droppedArtist: artist }
}

/**
 * Seed a PlayerSimState with a dropped artist. Pure helper — Math.random
 * lives in the SERVER (party/server.ts) which calls this with the chosen
 * artist. sim-engine remains zero-side-effect.
 */
export function seedDroppedArtist(
  playerSim: PlayerSimState,
  artist: Artist,
): PlayerSimState {
  const targetId = `artist:${artist}`
  const relationships = playerSim.relationships.map(r =>
    r.characterId === targetId
      ? {
          ...r,
          score: RELATIONSHIP_CONFIG.droppedSeedScore,
          isDroppedArtist: true,
          decayTimer: 0,
        }
      : r,
  )
  return { ...playerSim, relationships, droppedArtist: artist }
}

// ─── Phase 4 Plan 02: Landlord arc pure function ──────────────────────────

export interface ProgressLandlordResult {
  updatedPlayerSim: PlayerSimState
  /** True iff landlordStage advanced by 1 this call. */
  advanced: boolean
}

/**
 * Advance the landlord arc at most one stage per call based on the player's
 * current prestige. Monotonic (one-way ratchet): stage never decreases. Pure
 * — no Math.random / Date.now / console, no mutation of the input.
 *
 * Gate semantics (LANDLORD_CONFIG.prestigeThresholds):
 *   thresholds[0] → prestige required to STAY at stage 1 (gate for 1→2)
 *   thresholds[1] → gate for 2→3
 *   thresholds[2] → gate for 3→4
 *   thresholds[3] → gate for 4→5
 *
 *  - currentStage === 5  → terminal, no-op
 *  - prestige  <  threshold → advance to currentStage + 1, append to seen list
 *  - prestige  >= threshold → no-op (stalled)
 *
 * Intended call site: party/server.ts advanceFromSimDay, once per player per
 * sim_day, after resolveSlots and before advanceDay. The server passes the
 * player's PublicPlayer.prestige (server-authoritative) as the gate input —
 * clients cannot influence this value (T-4-10 mitigation).
 */
export function progressLandlord(
  playerSim: PlayerSimState,
  prestige: number,
): ProgressLandlordResult {
  const stage = playerSim.landlordStage
  if (stage >= 5) {
    return { updatedPlayerSim: playerSim, advanced: false }
  }
  const threshold = LANDLORD_CONFIG.prestigeThresholds[stage - 1]
  if (prestige >= threshold) {
    return { updatedPlayerSim: playerSim, advanced: false }
  }
  const nextStage = (stage + 1) as LandlordStage
  return {
    updatedPlayerSim: {
      ...playerSim,
      landlordStage: nextStage,
      seenLandlordStages: [...playerSim.seenLandlordStages, nextStage],
    },
    advanced: true,
  }
}

// ─── Phase 4 Plan 03: Drug system pure functions ──────────────────────────

/**
 * Append a new drug item to the player's inventory. The `id` is provided by
 * the caller (server-generated via crypto.randomUUID) so the engine stays
 * entropy-free. Display strings are sourced from DRUG_DEFINITIONS[kind] —
 * the gallery-bio register ("Untitled (White), mixed media, 2024" = 1g coke)
 * is the whole bit of the feature, so it lives in config, not at call sites.
 *
 * Pure: returns a new PlayerSimState; never mutates the input.
 */
export function addDrugItem(
  playerSim: PlayerSimState,
  kind: DrugItemKind,
  id: string,
): PlayerSimState {
  const def = DRUG_DEFINITIONS[kind]
  const item: DrugItem = {
    id,
    kind,
    displayLabel: def.displayLabel,
    displayMeta: def.displayMeta,
  }
  return { ...playerSim, drugs: [...playerSim.drugs, item] }
}

/**
 * Remove a drug item by id. Unknown ids return the input unchanged (no-op),
 * which is the correct behavior for the server's addDrugItem → removeDrugItem
 * party-use flow in the presence of a race. Pure: never mutates the input.
 */
export function removeDrugItem(
  playerSim: PlayerSimState,
  id: string,
): PlayerSimState {
  const idx = playerSim.drugs.findIndex(d => d.id === id)
  if (idx === -1) return playerSim
  const drugs = playerSim.drugs.slice()
  drugs.splice(idx, 1)
  return { ...playerSim, drugs }
}

export interface ApplyDrugEffectsResult {
  updatedPlayerSim: PlayerSimState
  statDeltas: Partial<Record<keyof PlayerStats, number>>
}

/**
 * Apply a drug's +Coolness / -Restedness effects to the player. Used at
 * party slots in party/server.ts after the item has been consumed (the
 * removeDrugItem call is the server's responsibility, not this function's).
 *
 * Both stats are clamped to [0, 100]; the returned deltas reflect the
 * ACTUAL change (post-clamp), so event logging and UI can show the real
 * mutation, not the uncapped intent. Pure: no mutation of the input.
 */
export function applyDrugEffects(
  playerSim: PlayerSimState,
  kind: DrugItemKind,
): ApplyDrugEffectsResult {
  const def = DRUG_DEFINITIONS[kind]
  const beforeCool = playerSim.coolness
  const beforeRest = playerSim.restedness
  const coolness = clamp(beforeCool + def.coolness, 0, 100)
  const restedness = clamp(beforeRest + def.restedness, 0, 100)
  return {
    updatedPlayerSim: { ...playerSim, coolness, restedness },
    statDeltas: {
      coolness: coolness - beforeCool,
      restedness: restedness - beforeRest,
    },
  }
}

/**
 * Per-sim_day risk tick. Three branches:
 *   - drugs.length >  DRUG_CONFIG.riskThreshold → risk += riskPerDay (clamped 100)
 *   - drugs.length === 0                        → risk = max(0, risk - 1)
 *   - otherwise                                 → risk unchanged
 *
 * Called inside party/server.ts advanceFromSimDay per player after
 * progressLandlord and before advanceDay. Pure: no mutation, no entropy.
 */
export function accumulateRisk(playerSim: PlayerSimState): PlayerSimState {
  const count = playerSim.drugs.length
  if (count > DRUG_CONFIG.riskThreshold) {
    return {
      ...playerSim,
      risk: clamp(playerSim.risk + DRUG_CONFIG.riskPerDay, 0, 100),
    }
  }
  if (count === 0) {
    return { ...playerSim, risk: Math.max(0, playerSim.risk - 1) }
  }
  return playerSim
}

export interface AuctionModifiers {
  bidCeilingMultiplier: number
  luckRoll: number
}

/**
 * Project sim state onto auction inputs. Pure projection — the auction
 * engine consumes these values via its own bid handlers.
 *
 * - Restedness < 30 reduces bid ceiling by 15% (the burnout penalty)
 * - Coolness scales the ceiling up to +50% at coolness=100
 * - Hotness multiplier flows through directly (0.5–2.0)
 */
export function applySimModifiers(
  _player: PublicPlayer,
  playerSim: PlayerSimState,
  sim: SimState,
): AuctionModifiers {
  const restednessFactor = playerSim.restedness < 30 ? 0.85 : 1.0
  const coolnessFactor = 1 + playerSim.coolness / 200       // 1.0 – 1.5
  const hotnessFactor = sim.artMarketHotness                 // 0.5 – 2.0
  return {
    bidCeilingMultiplier: restednessFactor * coolnessFactor * hotnessFactor,
    luckRoll: playerSim.luck,
  }
}

// Re-export factory helpers from sim-config so consumers can pull
// everything from one module.
export { createInitialPlayerSimState, createInitialSimState } from './sim-config'

// Also re-export SIM_CONFIG so callers don't need to import two modules
// just to read the timeout constant.
export {
  SIM_CONFIG,
  RELATIONSHIP_CONFIG,
  RELATIONSHIP_DEFINITIONS,
  LANDLORD_CONFIG,
  LANDLORD_MESSAGES,
  DRUG_CONFIG,
  DRUG_DEFINITIONS,
} from './sim-config'

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

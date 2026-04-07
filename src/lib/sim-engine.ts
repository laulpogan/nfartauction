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
} from '../types/game'
import { SLOT_DEFINITIONS, SIM_CONFIG } from './sim-config'

export interface ResolveSlotsResult {
  updatedPlayerSim: PlayerSimState
  updatedPlayerMoney: number
  events: SimEvent[]
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
  const events: SimEvent[] = []

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
  }

  return {
    updatedPlayerSim: {
      ...playerSim,
      coolness,
      restedness,
      luck,
      currentNeighborhood,
      // Clear scheduledSlots — the day's plan has been executed.
      scheduledSlots: [],
    },
    updatedPlayerMoney: money,
    events,
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
): { updatedSim: SimState; updatedPlayerSims: PlayerSimState[] } {
  const drifted = applyGlobalStatDrift(sim, drift)
  const updatedSim: SimState = {
    ...drifted,
    dayNumber: sim.dayNumber + 1,
  }
  return { updatedSim, updatedPlayerSims: allPlayerSims }
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
export { SIM_CONFIG } from './sim-config'

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

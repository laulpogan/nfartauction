// ─── Phase 3: Sim Loop Config ───────────────────────────────────────────────
//
// Single source of truth for sim economy constants, slot definitions,
// and neighborhood metadata. All values are linear placeholders chosen for
// playtest readability — DO NOT attempt mathematical balancing here.
//
// The dev-mode logSimTransaction is the only side effect in this module and
// it's gated on import.meta.env.DEV so production tree-shakes it out.

import type {
  SlotType,
  Neighborhood,
  SimEvent,
  PlayerSimState,
  SimState,
} from '../types/game'

export const SIM_CONFIG = {
  SLOTS_PER_DAY: 4,
  TRAVEL_COST_SLOTS: 1,
  INITIAL_COOLNESS: 20,
  INITIAL_RESTEDNESS: 80,
  INITIAL_LUCK: 50,
  INITIAL_PRESTIGE: 0,
  GLOBAL_STAT_DRIFT_RANGE: 10,
  SUBMISSION_TIMEOUT_MS: 60_000,
  INITIAL_HOTNESS: 1.0,
  INITIAL_GENTRIFICATION: 3,
  INITIAL_NFT_HYPE: 30,
} as const

export interface SlotDefinition {
  type: SlotType
  label: string
  description: string
  money: number       // delta to player.money (negative = cost, positive = income)
  coolness: number
  restedness: number
  luck: number
}

export const SLOT_DEFINITIONS: Record<SlotType, SlotDefinition> = {
  gallery_work:  { type: 'gallery_work',  label: 'GALLERY WORK',  description: 'Mind the desk',                money:  3000, coolness: -1, restedness: -10, luck:  0 },
  studio_visits: { type: 'studio_visits', label: 'STUDIO VISITS', description: 'See what is being made',       money: -1000, coolness:  4, restedness: -10, luck:  1 },
  art_fair:      { type: 'art_fair',      label: 'ART FAIR',      description: 'Trade floor energy',           money: -2000, coolness:  3, restedness: -15, luck:  2 },
  opening:       { type: 'opening',       label: 'OPENING',       description: 'Be seen',                      money:  -500, coolness:  5, restedness: -10, luck:  1 },
  party:         { type: 'party',         label: 'PARTY',         description: 'Wreckage and contacts',        money: -1500, coolness:  6, restedness: -20, luck:  3 },
  sleep:         { type: 'sleep',         label: 'SLEEP',         description: 'Rest',                         money:     0, coolness:  0, restedness:  25, luck:  0 },
}

export interface NeighborhoodDefinition {
  id: Neighborhood
  label: string
}

export const NEIGHBORHOOD_DEFINITIONS: Record<Neighborhood, NeighborhoodDefinition> = {
  gallery:   { id: 'gallery',   label: 'GALLERY DISTRICT' },
  warehouse: { id: 'warehouse', label: 'WAREHOUSE' },
  flatlands: { id: 'flatlands', label: 'FLATLANDS' },
  hotel:     { id: 'hotel',     label: 'HOTEL DISTRICT' },
  online:    { id: 'online',    label: 'ONLINE' },
}

// Dev-mode transaction log. Production builds drop this entirely via the
// import.meta.env.DEV branch elimination Vite performs at build time.
export function logSimTransaction(event: SimEvent, sessionId: string): void {
  if (import.meta.env.DEV) {

    console.debug(
      `[sim-tx] ${sessionId.slice(0, 6)} ${event.kind}`,
      event.description,
      event.statDeltas,
    )
  }
}

export function createInitialPlayerSimState(sessionId: string): PlayerSimState {
  return {
    sessionId,
    coolness: SIM_CONFIG.INITIAL_COOLNESS,
    restedness: SIM_CONFIG.INITIAL_RESTEDNESS,
    luck: SIM_CONFIG.INITIAL_LUCK,
    currentNeighborhood: 'gallery',
    scheduledSlots: [],
    drugInventory: [],
    relationships: [],
    faction: null,
  }
}

export function createInitialSimState(): SimState {
  return {
    dayNumber: 0,
    artMarketHotness: SIM_CONFIG.INITIAL_HOTNESS,
    gentrificationLevel: SIM_CONFIG.INITIAL_GENTRIFICATION,
    nftHypeCycle: SIM_CONFIG.INITIAL_NFT_HYPE,
    neighborhoods: ['gallery', 'warehouse', 'flatlands', 'hotel', 'online'],
  }
}

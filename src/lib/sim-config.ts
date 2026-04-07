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
  Relationship,
  LandlordStage,
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

// ─── Phase 4 Plan 01: Relationship system ──────────────────────────────────

export const RELATIONSHIP_CONFIG = {
  /** Exponential decay multiplier applied per uncontacted sim_day. */
  decayFactor: 0.85,
  /** score < coldThreshold renders the 'COLD' chip. */
  coldThreshold: 25,
  /** Max absolute value of a bid-likelihood modifier ± 0.15. */
  bidModMaxAbs: 0.15,
  /** Seed score for the dropped artist — also the lower clamp on Relationship.score. */
  droppedSeedScore: -50,
  /** Multiplier on roundValues[droppedArtist] for the credibility penalty. */
  credibilityScale: 0.05,
  /** Starting score for every non-dropped relationship. */
  initialScore: 50,
} as const

/**
 * Named characters. The 5 artists mirror the Artist enum in game.ts and use
 * characterId = 'artist:<artistId>' so the server seed and engine derivation
 * can map between them without another lookup table. Collectors are authored
 * with short gallery-bio descriptions (wall-label register — no marketing
 * copy). Each collector is assigned a faction to distribute alignment across
 * all four factions.
 */
export const RELATIONSHIP_DEFINITIONS: Relationship[] = [
  // ── Artists ────────────────────────────────────────────────────────────
  {
    characterId: 'artist:lite_metal',
    kind: 'artist',
    displayName: 'Lite Metal',
    bio: 'Large-scale oil painter working out of a former foundry in the Warehouse district.',
    factionAlignment: 'painters',
    score: RELATIONSHIP_CONFIG.initialScore,
    decayTimer: 0,
    isDroppedArtist: false,
  },
  {
    characterId: 'artist:yoko',
    kind: 'artist',
    displayName: 'Yoko',
    bio: 'Text and performance work addressing surveillance and municipal bureaucracy.',
    factionAlignment: 'social_political',
    score: RELATIONSHIP_CONFIG.initialScore,
    decayTimer: 0,
    isDroppedArtist: false,
  },
  {
    characterId: 'artist:christine_p',
    kind: 'artist',
    displayName: 'Christine P.',
    bio: 'Cast concrete and found-object sculpture, often sited outdoors.',
    factionAlignment: 'sculptors',
    score: RELATIONSHIP_CONFIG.initialScore,
    decayTimer: 0,
    isDroppedArtist: false,
  },
  {
    characterId: 'artist:karl_gitter',
    kind: 'artist',
    displayName: 'Karl Gitter',
    bio: 'Small-format egg tempera still lifes painted in a single sitting.',
    factionAlignment: 'painters',
    score: RELATIONSHIP_CONFIG.initialScore,
    decayTimer: 0,
    isDroppedArtist: false,
  },
  {
    characterId: 'artist:krypto',
    kind: 'artist',
    displayName: 'Krypto',
    bio: 'Single-channel video and generative shader pieces; prolific on-chain.',
    factionAlignment: 'video_art',
    score: RELATIONSHIP_CONFIG.initialScore,
    decayTimer: 0,
    isDroppedArtist: false,
  },
  // ── Collectors ────────────────────────────────────────────────────────
  {
    characterId: 'collector:helena_v',
    kind: 'collector',
    displayName: 'Helena V.',
    bio: 'Second-generation collector; buys mid-career painting for a family foundation.',
    factionAlignment: 'painters',
    score: RELATIONSHIP_CONFIG.initialScore,
    decayTimer: 0,
    isDroppedArtist: false,
  },
  {
    characterId: 'collector:bram_k',
    kind: 'collector',
    displayName: 'Bram K.',
    bio: 'Architect-collector, interested in material-forward sculpture for private courtyards.',
    factionAlignment: 'sculptors',
    score: RELATIONSHIP_CONFIG.initialScore,
    decayTimer: 0,
    isDroppedArtist: false,
  },
  {
    characterId: 'collector:margot_r',
    kind: 'collector',
    displayName: 'Margot R.',
    bio: 'Former curator; acquires socially-engaged practices on behalf of an estate trust.',
    factionAlignment: 'social_political',
    score: RELATIONSHIP_CONFIG.initialScore,
    decayTimer: 0,
    isDroppedArtist: false,
  },
  {
    characterId: 'collector:tobias_o',
    kind: 'collector',
    displayName: 'Tobias O.',
    bio: 'Early crypto yield; collects video, net, and generative work with provenance on-chain.',
    factionAlignment: 'video_art',
    score: RELATIONSHIP_CONFIG.initialScore,
    decayTimer: 0,
    isDroppedArtist: false,
  },
  {
    characterId: 'collector:inez_m',
    kind: 'collector',
    displayName: 'Inez M.',
    bio: 'Dentist by practice, painter by avocation; buys small works directly from studios.',
    factionAlignment: 'painters',
    score: RELATIONSHIP_CONFIG.initialScore,
    decayTimer: 0,
    isDroppedArtist: false,
  },
]

// ─── Phase 4 Plan 02: Landlord arc ─────────────────────────────────────────

/**
 * Prestige thresholds gating stage advancement. Each index i holds the
 * prestige required to NOT advance from stage (i+1) to stage (i+2) on a
 * given sim_day. If PublicPlayer.prestige is BELOW the threshold for the
 * current stage, progressLandlord advances one step. Low prestige → fast
 * loss; high prestige → stall. Values are playtest placeholders.
 *
 *   thresholds[0] → stay at stage 1 (gate for 1→2)
 *   thresholds[1] → stay at stage 2 (gate for 2→3)
 *   thresholds[2] → stay at stage 3 (gate for 3→4)
 *   thresholds[3] → stay at stage 4 (gate for 4→5)
 */
export const LANDLORD_CONFIG = {
  prestigeThresholds: [10, 25, 45, 70] as const,
} as const

/**
 * Authored landlord text for each stage. One sentence, zine register — no
 * marketing copy, no exclamation marks. Rendered as iMessage-style bubbles
 * by LandlordMessages.tsx using WallLabel typography.
 */
export const LANDLORD_MESSAGES: Record<LandlordStage, string> = {
  1: 'hey just a heads-up, slight lease adjustment coming. nothing to worry about.',
  2: 'got a sec to grab coffee this week? want to walk through the new lease terms in person.',
  3: 'attaching the new lease. effective next month. let me know if questions.',
  4: 'renovation crew is in the building thurs–sun. please move all stock away from the south wall.',
  5: 'as discussed, lease terminates end of month. happy to recommend a relocation broker.',
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
    // Deep clone so players never share relationship array references.
    relationships: RELATIONSHIP_DEFINITIONS.map(r => ({ ...r })),
    drugInventory: [],
    droppedArtist: null,
    // Phase 4 Plan 02: landlord arc starts at stage 1 with stage 1 already in
    // the seen list so the first bubble is visible immediately on day 1.
    landlordStage: 1,
    seenLandlordStages: [1],
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

// ─── Phase 7: Bot Player Config ─────────────────────────────────────────────
//
// Single source of truth for bot personality profiles, names, and strategy
// weight constants. All values are playtest placeholders — tune freely.
//
// No side effects, no entropy, no imports beyond types.

import type { BotPersonality, SlotType, Neighborhood } from '../types/game'

/**
 * Wall-label-style bot display names, keyed by personality.
 */
export const BOT_NAMES: Record<BotPersonality, string[]> = {
  conservative: ['Marta G.', 'Henrik L.'],
  aggressive: ['Damien K.', 'Yayoi M.'],
  erratic: ['Banksy Jr.', 'AI Warhol'],
} as const

/**
 * Core tuning constants for bot bid behavior.
 *
 *  - maxBotCount: lobby cap on simultaneous bots
 *  - bidNoiseRange: per-personality noise multiplier on perceived value
 *  - valuationMultiplier: base bid aggressiveness scalar
 *  - passThreshold: fraction of money beyond which the bot passes
 */
export const BOT_CONFIG = {
  maxBotCount: 3,
  bidNoiseRange: {
    conservative: 0.05,
    aggressive: 0.15,
    erratic: 0.30,
  } as Record<BotPersonality, number>,
  valuationMultiplier: {
    conservative: 0.6,
    aggressive: 1.2,
    erratic: 1.0,
  } as Record<BotPersonality, number>,
  passThreshold: {
    conservative: 0.7,
    aggressive: 0.3,
    erratic: 0.5,
  } as Record<BotPersonality, number>,
} as const

/**
 * Sim-day slot selection weights per personality. Higher weight = more likely
 * to be chosen in the weighted-random selection inside chooseBotSlots.
 *
 * Conservative: gallery_work + sleep heavy.
 * Aggressive: party + art_fair heavy.
 * Erratic: uniform.
 */
export const BOT_SLOT_WEIGHTS: Record<BotPersonality, Record<SlotType, number>> = {
  conservative: {
    gallery_work: 3,
    studio_visits: 2,
    art_fair: 1,
    opening: 2,
    party: 1,
    sleep: 3,
  },
  aggressive: {
    gallery_work: 1,
    studio_visits: 2,
    art_fair: 3,
    opening: 2,
    party: 3,
    sleep: 1,
  },
  erratic: {
    gallery_work: 2,
    studio_visits: 2,
    art_fair: 2,
    opening: 2,
    party: 2,
    sleep: 2,
  },
}

/**
 * Neighborhood preference lists per personality. chooseBotSlots picks from
 * these using the random parameter.
 */
export const BOT_NEIGHBORHOOD_PREFS: Record<BotPersonality, Neighborhood[]> = {
  conservative: ['gallery', 'warehouse'],
  aggressive: ['hotel', 'flatlands'],
  erratic: ['gallery', 'warehouse', 'flatlands', 'hotel', 'online'],
}

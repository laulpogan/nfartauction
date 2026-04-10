---
phase: 07-bot-players
plan: 01
subsystem: bot-engine
tags: [bot, ai, pure-functions, game-logic]
dependency_graph:
  requires: [engine.ts, sim-config.ts, game.ts]
  provides: [bot-engine.ts, bot-config.ts, BotPersonality type]
  affects: [party/server.ts (Plan 02 will consume)]
tech_stack:
  added: []
  patterns: [pure-function-engine, seeded-PRNG, weighted-random-selection]
key_files:
  created:
    - src/lib/bot-config.ts
    - src/lib/bot-engine.ts
    - src/lib/bot-engine.test.ts
  modified:
    - src/types/game.ts
decisions:
  - Used LCG-style seeded PRNG for per-slot entropy derivation in chooseBotSlots
  - perceiveArtistValue uses roundValues + artistCounts*5000 as demand signal
  - Bots never initiate double auction bids (return null); participate via chooseBotSecondCard
  - Conservative avoids double auction cards when non-double alternative of same artist exists
metrics:
  duration: 231s
  completed: "2026-04-10T03:59:00Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 20
  tests_total: 264
---

# Phase 7 Plan 01: Bot Decision Engine Summary

Pure decision functions for all bot actions (card play, bidding across 5 auction types, second card for doubles, sim-day slot selection) with 3 personality profiles and deterministic seeded entropy.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add BotPersonality type and bot-config.ts constants | 6badc32 | src/types/game.ts, src/lib/bot-config.ts |
| 2 | Create bot-engine.ts pure decision functions + tests | 8dfe489 | src/lib/bot-engine.ts, src/lib/bot-engine.test.ts |

## Implementation Details

### bot-config.ts
- `BOT_NAMES`: Wall-label-style names per personality (Marta G., Damien K., Banksy Jr., etc.)
- `BOT_CONFIG`: maxBotCount=3, bidNoiseRange/valuationMultiplier/passThreshold per personality
- `BOT_SLOT_WEIGHTS`: Slot type weights (conservative=gallery+sleep, aggressive=party+art_fair, erratic=uniform)
- `BOT_NEIGHBORHOOD_PREFS`: Neighborhood lists per personality

### bot-engine.ts (4 exported functions, all pure)
- `chooseBotCard(hand, game, personality, random)`: Conservative picks highest-value artist, aggressive chases trending, erratic picks randomly. Avoids double auction type when non-double alternative exists.
- `chooseBotBid(auction, game, personality, money, random)`: Dispatches by all 5 auction types. Uses perceived value (roundValues + demand signal) scaled by personality multiplier + noise.
- `chooseBotSecondCard(hand, auction, personality, random)`: Finds matching artist for double auctions. Conservative prefers non-double type.
- `chooseBotSlots(playerSim, game, personality, random)`: Generates 4 slots via weighted random selection using LCG-seeded PRNG for per-slot entropy.

### Test Coverage
20 new tests covering all functions with deterministic random seeds (0.0, 0.3, 0.5, 0.7, 0.99). Distribution tests confirm personality differentiation across 100 samples.

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **Seeded PRNG for slot entropy**: chooseBotSlots uses a LCG-style hash chain (`seed * 1103515245 + 12345`) to derive per-slot random values from a single random parameter, avoiding the need for multiple random inputs.
2. **Perceived value formula**: `roundValues[artist] + artistCounts[artist] * 5000` balances cumulative market value with current-round demand signal.
3. **Double auction passivity**: Bots return null for chooseBotBid on double auctions, participating only via chooseBotSecondCard when they have a matching artist card.

## Self-Check: PASSED

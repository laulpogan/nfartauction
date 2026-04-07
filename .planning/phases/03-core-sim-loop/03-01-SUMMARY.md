---
phase: 03-core-sim-loop
plan: 01
subsystem: sim-engine
tags: [types, sim-engine, pure-functions, tdd, config]
requirements: [SIM-02, SIM-03, SIM-07, SIM-08]
dependency_graph:
  requires:
    - src/types/game.ts (Phase 1 PublicPlayer/GameState shape)
    - src/contexts/NeighborhoodContext.tsx (Neighborhood type)
    - src/lib/engine.ts (pure-function pattern to mirror)
  provides:
    - GamePhase, SimState, PlayerSimState, SlotType, TimeSlot, SimEvent, SubmitSlotsPayload
    - SIM_CONFIG, SLOT_DEFINITIONS, NEIGHBORHOOD_DEFINITIONS
    - resolveSlots, advanceDay, applyGlobalStatDrift, applySimModifiers
    - createInitialPlayerSimState, createInitialSimState, logSimTransaction
  affects:
    - src/lib/engine.ts (makePublicPlayer defaults coolness/prestige to 0)
    - party/server.ts (lobby init defaults phase + sim, sessionToPublicPlayer mirrors fields)
    - test fixtures in engine.test.ts and auction-skins.test.tsx
tech-stack:
  added: []
  patterns:
    - "Pure functional state-in/state-out mirroring engine.ts"
    - "Drift sourced as parameter (server passes seeded value) — keeps engine deterministic"
    - "Stat clamps applied at every write site, defense-in-depth on top of Zod"
key-files:
  created:
    - src/lib/sim-config.ts
    - src/lib/sim-engine.ts
    - src/lib/sim-engine.test.ts
  modified:
    - src/types/game.ts
    - src/lib/engine.ts
    - party/server.ts
    - src/lib/engine.test.ts
    - src/components/game/auction-skins/auction-skins.test.tsx
decisions:
  - "GamePhase is a 4-variant discriminated union; lobby is the resting state and carries no payload"
  - "PublicPlayer gains coolness and prestige; private sim stats stay in PlayerSimState only"
  - "Drift is a parameter, not sourced inside advanceDay — preserves purity and lets the server own entropy"
  - "Money floor clamped to 0 inside resolveSlots itself, not just at validation boundary (T-3-01 mitigation)"
  - "Unknown slot.type is silently skipped via SLOT_DEFINITIONS lookup guard (T-3-02)"
  - "Slot economy values are linear placeholders per CONTEXT.md — no balancing attempted"
  - "logSimTransaction lives in sim-config and is called by SERVER, not by sim-engine — purity preserved"
metrics:
  duration: 3min
  tasks: 2
  files_changed: 8
  tests_added: 20
  total_tests: 90
  completed: 2026-04-07
---

# Phase 3 Plan 1: Core Sim Types & Pure Engine Summary

Established the type contract and pure functional core for the entire Phase 3 sim layer in two atomic commits. Plans 03-02, 03-03, and 03-04 can now import GamePhase, SimState, PlayerSimState, SlotType, TimeSlot, SimEvent, the four sim-engine functions, and SIM_CONFIG / SLOT_DEFINITIONS / NEIGHBORHOOD_DEFINITIONS without modifying anything in this plan.

## What Shipped

### Task 1 — Type extensions + sim-config (commit `40bce1d`)

- `src/types/game.ts` extended with `GamePhase`, `SimState`, `PlayerSimState`, `SlotType`, `TimeSlot`, `SimEvent`, `PlayerStats`, `SubmitSlotsPayload`, plus message type stubs `YourSimStateMessage` and `SimDayResultMessage` for 03-02 to wire into the Zod inbound/outbound discriminated unions.
- `Neighborhood` re-exported from game.ts so sim consumers can pull everything from one types module.
- `PublicPlayer` gained two public-mirror sim fields: `coolness` and `prestige`. Private state (drugInventory/relationships/faction) stays exclusively in `PlayerSimState`.
- `GameState` gained `phase: GamePhase` and `sim: SimState`. The `PublicGameState` projection inherits both automatically because it uses `Omit<GameState, 'deck' | 'auction'>`.
- `src/lib/sim-config.ts` created with:
  - `SIM_CONFIG` — 11 economy constants (slots/day=4, travel cost=1 slot, initial coolness/restedness/luck/prestige, drift range, 60s timeout, initial global stats)
  - `SLOT_DEFINITIONS` — all 6 slot types (gallery_work, studio_visits, art_fair, opening, party, sleep) with money/coolness/restedness/luck deltas
  - `NEIGHBORHOOD_DEFINITIONS` — all 5 neighborhoods
  - `logSimTransaction` — dev-only console log gated on `import.meta.env.DEV`
  - `createInitialPlayerSimState`, `createInitialSimState` — factory helpers
- Minimal touches to existing call sites so nothing breaks: `engine.ts:makePublicPlayer` defaults coolness/prestige to 0, `party/server.ts:sessionToPublicPlayer` does the same, and the lobby init in server.ts now defaults `phase: { type: 'lobby' }` and `sim: createInitialSimState()`. Test fixtures in `engine.test.ts` and `auction-skins.test.tsx` updated identically.

### Task 2 — Pure functional sim-engine (commit `3cea961`)

- `src/lib/sim-engine.ts` exports four pure functions plus convenience re-exports of the factory helpers and `SIM_CONFIG`.

  ```typescript
  resolveSlots(playerSim, slots, publicSim, player) → { updatedPlayerSim, updatedPlayerMoney, events }
  advanceDay(sim, allPlayerSims, drift?) → { updatedSim, updatedPlayerSims }
  applyGlobalStatDrift(sim, drift) → SimState
  applySimModifiers(player, playerSim, sim) → { bidCeilingMultiplier, luckRoll }
  ```

- `resolveSlots` clamps coolness/restedness/luck to [0,100] and money floor to 0 at every write. Travel between neighborhoods emits its own SimEvent and consumes 5 restedness. Empty `slots[]` returns the player unchanged with zero events (the timeout path).
- `applyGlobalStatDrift` clamps hotness to [0.5, 2.0], gentrification to [1, 10] integer, nft hype to [0, 100].
- `advanceDay` accepts a deterministic `drift` parameter so the server can source entropy from a seeded RNG and tests can pass exact deltas.
- `applySimModifiers` projects sim state onto auction inputs without mutation: restedness < 30 triggers a 0.85x ceiling penalty, coolness scales the ceiling up to 1.5x at coolness=100, hotness flows through directly (0.5–2.0).

- `src/lib/sim-engine.test.ts` ships 20 vitest cases covering:
  - resolveSlots: empty/timeout, sleep clamp ceiling, gallery_work money, coolness floor clamp, coolness ceiling clamp, travel event emission, no-op when neighborhood matches, money floor clamp, scheduledSlots clear
  - applyGlobalStatDrift: hotness floor + ceiling, gentrification rounding + clamps, nft hype clamps
  - advanceDay: dayNumber increment, drift application, player sim pass-through
  - applySimModifiers: shape, burnout penalty monotonicity, coolness scaling monotonicity, luckRoll mirror

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run src/lib/sim-engine.test.ts` | 20/20 green |
| `npx vitest run` (full regression) | **90/90 green** (70 prior + 20 new) |
| `grep "type GamePhase" src/types/game.ts` | 1 match |
| `grep "SLOT_DEFINITIONS" src/lib/sim-config.ts` | 2 matches |
| Purity scan: `Math\.random\|Date\.now\|console\.` in sim-engine.ts | 0 in code (1 in comment) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical] PublicPlayer literal sites in test fixtures and party/server.ts**

- **Found during:** Task 1, after extending `PublicPlayer` with required `coolness` + `prestige` fields
- **Issue:** TypeScript would fail to compile because `engine.test.ts` and `auction-skins.test.tsx` construct PublicPlayer literals inline, and `party/server.ts:sessionToPublicPlayer` builds the same shape. Plan listed only the engine.ts touch as a minimal-touch fix.
- **Fix:** Defaulted `coolness: 0, prestige: 0` at every PublicPlayer construction site. Also defaulted `phase: { type: 'lobby' }` and `sim: createInitialSimState()` at every `GameState` construction site (lobby init in server.ts, fixtures in both test files).
- **Files modified:** `party/server.ts`, `src/lib/engine.test.ts`, `src/components/game/auction-skins/auction-skins.test.tsx`
- **Commit:** `40bce1d`

No architectural deviations. No auth gates. No checkpoints.

## Decision Rationale

- **Drift as parameter (not internal Math.random):** The plan said "deterministic via seeded helper or pure parameter for testability." I chose pure parameter — the server in 03-02 will source drift from a seeded PRNG, and tests pass exact deltas. This preserves purity absolutely (zero `Math.random`/`Date.now`/`console` in function bodies) and lets every test be a direct `expect(result).toBe(...)` rather than an approximation.
- **Travel as a side effect of the slot, not its own slot:** The CONTEXT.md says "travel between neighborhoods consumes one slot" and SIM_CONFIG.TRAVEL_COST_SLOTS = 1 reflects that, but at the engine level I modeled travel as an inline cost (5 restedness + a separate event) attached to whichever activity slot triggers it. The server-side scheduler will be the layer that decrements available slot capacity for travel — engine.ts only sees the resolved slot list. This keeps `resolveSlots` purely local to one player's day plan and matches the engine.ts pattern of receiving fully-validated input.
- **`logSimTransaction` lives in sim-config, not sim-engine:** Purity contract means sim-engine cannot call console at all. The dev log helper sits in sim-config for the SERVER (03-02) to call when broadcasting events.
- **Slot economy values are placeholders:** Per CONTEXT.md "DO NOT attempt mathematical balancing in code." Linear values chosen for readability: gallery_work=+$3000 (the only income source), party costs the most rest (-20), sleep recovers the most rest (+25). Tuning is a Phase 5/playtest concern.

## Threat Mitigations Applied

- **T-3-01 (Tampering on resolveSlots):** money floor clamp at 0, all stats clamped to [0,100] inside the engine itself, not just at the Zod boundary.
- **T-3-02 (Unknown slot.type):** SLOT_DEFINITIONS lookup guarded — unknown types are silently skipped via `if (!def) continue` rather than crashing.
- **T-3-03 (PlayerSimState information disclosure):** type shape exists; the server channel boundary (03-02) is responsible for never broadcasting it.
- **T-3-04 (DoS via huge slot array):** O(n) loop, empty array tested; 03-02 will Zod-cap the array length.
- **T-3-05 (Repudiation):** logSimTransaction is dev-mode only via `import.meta.env.DEV` branch elimination.

## Self-Check: PASSED

Files exist:
- FOUND: src/types/game.ts (extended)
- FOUND: src/lib/sim-config.ts
- FOUND: src/lib/sim-engine.ts
- FOUND: src/lib/sim-engine.test.ts

Commits exist:
- FOUND: 40bce1d (Task 1: types + sim-config)
- FOUND: 3cea961 (Task 2: sim-engine + tests)

Tests pass:
- FOUND: 90/90 vitest green
- FOUND: tsc --noEmit exit 0

---
phase: 04-sim-depth
plan: 03
subsystem: drugs-risk
tags: [drugs, risk, sim-engine, ui, inventory]
requirements: [DEPTH-06, DEPTH-07, DEPTH-08]
dependency_graph:
  requires:
    - src/types/game.ts (Phase 3 PlayerSimState, Phase 4-01/02 fields)
    - src/lib/sim-engine.ts (resolveSlots, progressLandlord, advanceDay)
    - src/lib/sim-config.ts
    - src/components/aesthetic/AppraisalForm.tsx
    - party/server.ts (advanceFromSimDay, crypto.randomUUID + Math.random)
  provides:
    - DrugItemKind, DrugItem types
    - DRUG_CONFIG (riskThreshold, riskPerDay, acquisitionProbability)
    - DRUG_DEFINITIONS (gallery-bio display strings + coolness/restedness per kind)
    - PlayerSimState.drugs and PlayerSimState.risk
    - addDrugItem, removeDrugItem, applyDrugEffects, accumulateRisk
      (pure; server-owned entropy)
    - DrugInventory React component (AppraisalForm-based)
    - Conditional RISK row on StatDisplay
  affects:
    - src/components/sim/SimPanel.tsx (renders DrugInventory after LandlordMessages)
    - party/server.ts (advanceFromSimDay runs acquisition → party use → risk)
    - src/components/sim/SimPanel.test.tsx (fixture backfilled with drugs/risk)
tech-stack:
  added: []
  patterns:
    - "Server-owned entropy boundary: Math.random and crypto.randomUUID
       live in party/server.ts only. The pure sim-engine receives
       pre-generated ids and chosen kinds via addDrugItem, keeping the
       determinism story consistent with the 04-01 dropped-artist seed."
    - "Acquisition/use walk the submitted plan BEFORE it is cleared by
       resolveSlots: the per-player plan is captured into a local
       Map<sessionId, TimeSlot[]> so the flatlands/hotel acquisition roll
       and the party-slot consumption pass can both iterate the original
       slots after resolveSlots has already run."
    - "Drugs are rendered as AppraisalRow entries with a data-drug-id
       sentinel wrapped around displayMeta — this lets RTL tests target
       individual items without a custom AppraisalForm extension, while
       the visual layout remains identical to the painting collection."
    - "RISK row is hidden at 0 so StatDisplay stays quiet until the
       player has actually acquired risk; this also means the existing
       Phase 3 default-fixture tests (risk: 0) did not need row-count
       updates."
key-files:
  created:
    - src/components/sim/DrugInventory.tsx
    - src/components/sim/DrugInventory.test.tsx
    - src/components/sim/StatDisplay.test.tsx
  modified:
    - src/types/game.ts
    - src/lib/sim-config.ts
    - src/lib/sim-engine.ts
    - src/lib/sim-engine.test.ts
    - src/components/sim/StatDisplay.tsx
    - src/components/sim/SimPanel.tsx
    - src/components/sim/SimPanel.test.tsx
    - party/server.ts
decisions:
  - "riskThreshold = 5, riskPerDay = 8, acquisitionProbability
     {flatlands: 0.35, hotel: 0.20}. Playtest placeholders; the whole
     DRUG_CONFIG lives in sim-config so tuning is a one-line change."
  - "DrugItem id is provided by the caller, not generated inside
     addDrugItem. party/server.ts uses crypto.randomUUID() when available
     with a Math.random fallback, keeping the pure engine entropy-free
     and mirroring the 04-01 seedDroppedArtist pattern."
  - "applyDrugEffects returns BOTH the updated playerSim AND the
     post-clamp statDeltas, so the server (and future dev-mode event
     logging) can surface the real mutation, not the uncapped intent."
  - "accumulateRisk has three branches: strict-greater-than the
     threshold increments by riskPerDay (clamped 100), empty inventory
     decays by 1 (floor 0), otherwise no change. At exactly threshold
     the player is static, which gives the explicit 5-item comfort zone
     the plan calls for."
  - "DrugInventory wraps AppraisalForm directly (not <section>+AppraisalForm
     like LandlordMessages) because its content IS form-shaped rows —
     the 'drugs treated like paintings on the same form' joke is the
     whole point, so the wrapper has to be the form, not a shell around
     one."
  - "RISK row is conditional (hidden when risk === 0) instead of always
     visible. This keeps the Phase 3 default-fixture tests passing
     without backfilling a row count, and matches the 'the stat appears
     when the behavior appears' pattern landlordStage uses."
metrics:
  duration: ~6min
  tasks: 2
  files_changed: 10
  tests_added: 20
  total_tests: 189
  completed: 2026-04-06
---

# Phase 4 Plan 03: Drugs + Risk Summary

The drug inventory + Risk stat system. Drugs are acquired probabilistically
from Flatlands/Hotel slots (rolled server-side via Math.random +
crypto.randomUUID), consumed at parties for +Coolness/-Restedness, and
displayed on the SAME AppraisalForm primitive as the painting collection —
"Untitled (White), mixed media, 2024" literally is 1g of coke, which is
the whole bit. Carrying more than 5 units accumulates Risk on each
sim_day; an empty inventory decays Risk by 1. Risk surfaces as a
conditional row on StatDisplay when it goes above zero. All sim-engine
functions remain pure; entropy lives in `party/server.ts`.

## What Shipped

### Task 1 — Types + sim-config + sim-engine pure functions (commit `b58861f`)

**`src/types/game.ts`** — Added `DrugItemKind` (`coke | mdma | ketamine |
pills`) and `DrugItem { id, kind, displayLabel, displayMeta }`. On
`PlayerSimState`, replaced the inert `drugInventory: never[]` stub with:

```typescript
drugs: DrugItem[]
risk: number
```

**`src/lib/sim-config.ts`** — Added two exports:

```typescript
export const DRUG_CONFIG = {
  riskThreshold: 5,
  riskPerDay: 8,
  acquisitionProbability: { flatlands: 0.35, hotel: 0.20 },
} as const

export const DRUG_DEFINITIONS: Record<DrugItemKind, {
  displayLabel: string
  displayMeta: string
  coolness: number
  restedness: number
}> = {
  coke:     { displayLabel: 'Untitled (White)',       displayMeta: 'mixed media, 2024',     coolness: 8,  restedness: -15 },
  mdma:     { displayLabel: 'Heart in Hand',          displayMeta: 'pressed pigment, 2024', coolness: 12, restedness: -25 },
  ketamine: { displayLabel: 'Untitled (After Hours)', displayMeta: 'powder on glass, 2024', coolness: 6,  restedness: -10 },
  pills:    { displayLabel: 'Lozenges (Series II)',   displayMeta: 'edition of 100, 2024',  coolness: 5,  restedness:  -8 },
}
```

Updated `createInitialPlayerSimState` to initialize `drugs: []` and
`risk: 0` and removed the dead `drugInventory: []` line.

**`src/lib/sim-engine.ts`** — Four pure functions (no Math.random,
Date.now, or console), all written as state-in/state-out:

- `addDrugItem(playerSim, kind, id)` — appends a DrugItem sourced from
  DRUG_DEFINITIONS[kind]. id is caller-provided (entropy stays in the
  server layer).
- `removeDrugItem(playerSim, id)` — removes by id; unknown ids are a
  no-op (correct race handling for the acquisition → party-use flow).
- `applyDrugEffects(playerSim, kind)` — applies kind-specific deltas to
  coolness/restedness, clamped to [0, 100]. Returns
  `{ updatedPlayerSim, statDeltas }` so the server and UI can log the
  real post-clamp mutation.
- `accumulateRisk(playerSim)` — per-sim_day tick. Strictly-greater-than
  threshold → `risk += riskPerDay` (clamped 100); empty inventory →
  `risk = max(0, risk - 1)`; otherwise unchanged. Called per-player
  inside `advanceFromSimDay` after `progressLandlord` and before
  `advanceDay`.

`DRUG_CONFIG` and `DRUG_DEFINITIONS` are re-exported from sim-engine so
callers can keep a single import module.

**`src/lib/sim-engine.test.ts`** — 12 new vitest cases:

1. `addDrugItem` appends with correct display strings
2. `addDrugItem` does not mutate input (purity)
3. `removeDrugItem` removes by id
4. `removeDrugItem` is a no-op on unknown ids
5. `applyDrugEffects` applies coke deltas correctly
6. `applyDrugEffects` clamps coolness at 100 and restedness at 0
7. `applyDrugEffects` does not mutate input
8. `accumulateRisk` increments at strictly > threshold
9. `accumulateRisk` is a no-op at exactly the threshold
10. `accumulateRisk` clamps to 100
11. `accumulateRisk` decays by 1 with empty inventory (floor 0)
12. `accumulateRisk` does not mutate input

### Task 2 — Server wiring + DrugInventory UI + StatDisplay RISK row (commit `68765e6`)

**`party/server.ts`** — Restructured the per-player block inside
`advanceFromSimDay`. New order (unchanged from 04-02 up through
resolveSlots, then inserting the drug passes):

1. `resolveSlots` — existing (Phase 3)
2. **Drug acquisition rolls** — NEW. Iterates the captured
   `submittedPlansBySession[sessionId]` TimeSlot array. For each slot
   with `neighborhood === 'flatlands' || neighborhood === 'hotel'`, rolls
   `Math.random() < DRUG_CONFIG.acquisitionProbability[neighborhood]`.
   On a hit, picks a uniform `DrugItemKind` and generates an id with
   `crypto.randomUUID()` (with a `Date.now()+Math.random` fallback for
   environments without crypto.randomUUID), then calls `addDrugItem`.
3. **Party-slot use** — NEW. For each `slot.type === 'party'` with
   `ps.drugs.length > 0`, takes `drugs[0]`, calls `applyDrugEffects`
   with its kind, then `removeDrugItem` with its id. The resulting
   coolness is mirrored onto `updatedPlayers[i].coolness` so opponents
   see the party-fuelled bump via the PublicPlayer projection without
   ever seeing the inventory.
4. `progressLandlord` — existing (04-02)
5. **`accumulateRisk`** — NEW. Runs per-player; clamps to [0, 100].
6. `advanceDay` — existing (Phase 3 + 04-01 decay)

A local `submittedPlansBySession = new Map<string, TimeSlot[]>()` captures
each player's `ps.scheduledSlots` BEFORE `resolveSlots` returns
`scheduledSlots: []`, so both the acquisition and use passes can
iterate the original plan. This was the main wiring gotcha — resolveSlots
clears the plan as its last step, so you have to snapshot it first.

**`src/components/sim/DrugInventory.tsx`** — New component.

```typescript
export interface DrugInventoryProps {
  playerSim: PlayerSimState | null
}
```

- `playerSim === null` → `null`
- Empty inventory → single `{ label: '—', value: 'no acquisitions' }` row
- Populated → one AppraisalRow per DrugItem, with the value wrapped in
  `<span data-drug-id={item.id}>{displayMeta}</span>` so each item is
  addressable from tests without extending AppraisalForm

Wrapped in `<AppraisalForm title="INVENTORY" formNumber="FORM I-08">` —
identical visual layout to the (future) painting collection appraisal,
which is the whole point of the system.

**`src/components/sim/DrugInventory.test.tsx`** — 5 RTL cases:
- null playerSim → null render
- empty state shows 'no acquisitions' and has zero `[data-drug-id]` rows
- populated inventory produces one `[data-drug-id]` row per item with
  correct ids and display labels
- `displayMeta` is rendered alongside `displayLabel`
- INVENTORY / FORM I-08 headers are present

**`src/components/sim/StatDisplay.tsx`** — Added a conditional `RISK` row
after the `LUCK` row, rendering only when `playerSim.risk > 0`. Hidden-
at-0 matches the landlordStage pattern: the stat surfaces when the
behavior surfaces.

**`src/components/sim/StatDisplay.test.tsx`** — New dedicated test file
with 3 RTL cases: RISK hidden at 0, RISK visible at 17, and the
COOLNESS/RESTEDNESS/LUCK rows are always present with a playerSim.

**`src/components/sim/SimPanel.tsx`** — Imported `DrugInventory` and
rendered `<DrugInventory playerSim={playerSim} />` after `LandlordMessages`
and before `NeighborhoodMap` — the position the plan called for.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run src/lib/sim-engine.test.ts` | 62/62 green (50 prior + 12 new) |
| `npx vitest run` (full regression) | **189/189 green** (169 prior + 20 new) |
| `grep -c "DRUG_DEFINITIONS" src/lib/sim-config.ts` | 1 |
| `grep -cE "applyDrugEffects\|accumulateRisk\|addDrugItem\|removeDrugItem" src/lib/sim-engine.ts` | 6 |
| `grep -nE "Math\.random\|Date\.now\|console\." src/lib/sim-engine.ts` (in code) | 0 (all matches are in comments) |
| `grep "drugInventory" src/types/game.ts src/lib/sim-config.ts src/lib/sim-engine.ts party/server.ts` | 0 lines (rename complete) |
| `grep -cE "addDrugItem\|applyDrugEffects\|accumulateRisk" party/server.ts` | 9 |
| `grep -c "DrugInventory" src/components/sim/SimPanel.tsx` | 2 |
| `grep -c "AppraisalForm" src/components/sim/DrugInventory.tsx` | 4 |
| `grep -c "data-drug-id" src/components/sim/DrugInventory.tsx` | 3 |
| `grep -c "RISK" src/components/sim/StatDisplay.tsx` | 2 |
| Privacy: `derivePublicState` body `playerSim` references | 0 |

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] SimPanel.test.tsx fixture references the
removed `drugInventory` field**
- **Found during:** Task 1, first `tsc --noEmit` after the
  `PlayerSimState` rename from `drugInventory` to `drugs` + `risk`.
- **Issue:** The pre-existing SimPanel test constructs a literal
  `PlayerSimState` with `drugInventory: []`, which became a compile
  error the moment the field was removed.
- **Fix:** Replaced with `drugs: [], risk: 0`.
- **Files modified:** `src/components/sim/SimPanel.test.tsx`
- **Commit:** `b58861f` (bundled with Task 1)

### Intentional design variances

**crypto.randomUUID fallback**
- The plan said "use `crypto.randomUUID()` (PartyKit / Cloudflare
  Workers expose this globally)". I added a defensive fallback
  (`drug-${Date.now()}-${Math.floor(Math.random()*1e9)}`) in case the
  runtime doesn't expose it — this is zero cost in the happy path
  (`typeof crypto !== 'undefined' && 'randomUUID' in crypto`) and
  avoids a runtime crash if the PartyKit environment differs from
  expectation. Still server-side entropy; purity of the engine is
  unaffected.

**DrugInventory wraps AppraisalForm directly (no `<section>` wrapper)**
- LandlordMessages uses `<section>` + top border because it's an
  iMessage bubble list. DrugInventory's content IS form-shaped rows,
  so wrapping the AppraisalForm in another element would fight the
  "drugs treated like paintings on the same form" joke. The component
  returns the AppraisalForm directly.

**RISK row hidden at 0 instead of always visible**
- The plan said "renders only when `playerSim && playerSim.risk > 0`"
  so this is a direct implementation, not a deviation. Calling it out
  because a naive reading might have added it unconditionally.

**New dedicated `StatDisplay.test.tsx`**
- The plan said "Add a new test case to StatDisplay's test file (or
  SimPanel.test.tsx if no dedicated StatDisplay test exists)". I chose
  to create a new dedicated `StatDisplay.test.tsx` file instead of
  adding the case to `SimPanel.test.tsx`. The StatDisplay test is 3
  small cases that don't depend on the full SimPanel wiring, so
  isolating them keeps the SimPanel test focused on its own scope and
  makes future StatDisplay evolution cheaper.

No architectural deviations. No auth gates. No checkpoints.

## Threat Mitigations Applied

| Threat | Status | Mechanism |
|--------|--------|-----------|
| T-4-12 (Client-injected drug items) | mitigate | `SUBMIT_SLOTS` Zod schema has no drug fields; `addDrugItem` is called only inside `advanceFromSimDay` after the server-rolled acquisition pass. Client cannot reach the writer. |
| T-4-13 (Client-claimed party use without an item) | mitigate | Party-slot use is gated on `ps.drugs.length > 0` inside `advanceFromSimDay`. The client cannot fake a drugs entry (T-4-12) and cannot reach the consumption path directly. |
| T-4-14 (Info disclosure of drugs/risk in public broadcast) | mitigate | `drugs` and `risk` live on `PlayerSimState`, which `derivePublicState` already strips. Verified: `derivePublicState` body still has 0 references to `playerSim`. |
| T-4-15 (Risk value manipulation) | mitigate | `accumulateRisk` is the only writer for the risk field; called only inside `advanceFromSimDay`; clamped to [0, 100]. Client has no message type that touches the field. |
| T-4-16 (Acquisition rolls not logged) | accept | Session-scoped; can be surfaced via `logSimTransaction` in dev mode during playtest. |
| T-4-17 (Unbounded drugs array) | mitigate | Acquisition rate-limited by `SIM_CONFIG.SLOTS_PER_DAY` (4/day); threshold + party-use create natural pressure to consume; no client-driven growth path. |

## Privacy Guarantees

- `DrugInventory` receives only `playerSim` (this connection's private
  state). It never touches `game.players[i]` for any `i` and never
  iterates opponent sim state.
- Drug acquisition and use happen inside `advanceFromSimDay` on
  `updatedPlayerSimMap`, which is function-local. `drugs` and `risk`
  never reach `derivePublicState` or `broadcastStateSecure`.
- The only public side-effect is the coolness mirror on
  `updatedPlayers[i].coolness`, which Phase 3 already exposes. Drug
  provenance is not inferable from the coolness bump — regular party
  slots also bump coolness via the base slot definition.
- Each connection's `YOUR_SIM_STATE` message carries only its own
  drugs + risk — the same per-connection lookup as Phase 3's hand
  distribution.

## Known Stubs

None. All acquisition/use/risk paths are live; the pure engine has full
test coverage; the UI renders from the authoritative `playerSim.drugs`
and `playerSim.risk` fields; the server runs the full pipeline every
sim_day inside `advanceFromSimDay`. The plan's full behavior block is
implemented.

## Commits

- `b58861f` — feat(04-03): add drug type + sim-config + sim-engine pure functions
- `68765e6` — feat(04-03): wire drug acquisition/use/risk server step + DrugInventory UI

## Self-Check: PASSED

Files exist:
- FOUND: src/types/game.ts (extended)
- FOUND: src/lib/sim-config.ts (extended)
- FOUND: src/lib/sim-engine.ts (extended)
- FOUND: src/lib/sim-engine.test.ts (extended)
- FOUND: src/components/sim/DrugInventory.tsx
- FOUND: src/components/sim/DrugInventory.test.tsx
- FOUND: src/components/sim/StatDisplay.tsx (modified)
- FOUND: src/components/sim/StatDisplay.test.tsx
- FOUND: src/components/sim/SimPanel.tsx (modified)
- FOUND: src/components/sim/SimPanel.test.tsx (modified)
- FOUND: party/server.ts (modified)

Commits exist:
- FOUND: b58861f (Task 1: types + config + engine + tests)
- FOUND: 68765e6 (Task 2: server wiring + DrugInventory + StatDisplay RISK)

Tests pass:
- FOUND: 189/189 vitest green (169 prior + 20 new)
- FOUND: tsc --noEmit exit 0

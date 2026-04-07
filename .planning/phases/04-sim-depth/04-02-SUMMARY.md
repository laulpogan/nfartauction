---
phase: 04-sim-depth
plan: 02
subsystem: landlord-arc
tags: [landlord, prestige, sim-engine, ui, narrative]
requirements: [DEPTH-04, DEPTH-05]
dependency_graph:
  requires:
    - src/types/game.ts (Phase 3 PlayerSimState, Phase 4 Plan 01 relationships)
    - src/lib/sim-engine.ts (resolveSlots, advanceDay from Phase 3/04-01)
    - src/lib/sim-config.ts
    - src/components/aesthetic/WallLabel.tsx
    - party/server.ts (advanceFromSimDay, PublicPlayer.prestige)
  provides:
    - LandlordStage type (1..5)
    - LANDLORD_CONFIG.prestigeThresholds, LANDLORD_MESSAGES (5 authored strings)
    - PlayerSimState.landlordStage and PlayerSimState.seenLandlordStages
    - progressLandlord(playerSim, prestige): pure monotonic ratchet
    - LandlordMessages React component
  affects:
    - src/components/sim/SimPanel.tsx (renders LandlordMessages between
      RelationshipPanel and NeighborhoodMap)
    - party/server.ts (advanceFromSimDay calls progressLandlord per player
      after resolveSlots, before advanceDay)
    - src/components/sim/SimPanel.test.tsx (fixture backfilled with
      landlordStage / seenLandlordStages)
tech-stack:
  added: []
  patterns:
    - "One-way ratchet: progressLandlord only ever advances the stage.
       Monotonicity is enforced inside the pure function, not at call sites,
       so T-4-08 holds regardless of future callers."
    - "Server-authoritative gate input: prestige is read from PublicPlayer
       (set only by engine paths), never from a client message."
    - "Seen list is append-only and initialized to [1] by
       createInitialPlayerSimState so the first bubble is visible on day 1
       without a 'first advance' edge case."
key-files:
  created:
    - src/components/sim/LandlordMessages.tsx
    - src/components/sim/LandlordMessages.test.tsx
  modified:
    - src/types/game.ts
    - src/lib/sim-config.ts
    - src/lib/sim-engine.ts
    - src/lib/sim-engine.test.ts
    - src/components/sim/SimPanel.tsx
    - src/components/sim/SimPanel.test.tsx
    - party/server.ts
decisions:
  - "prestigeThresholds = [10, 25, 45, 70]. Placeholder values chosen for
     playtest readability — low prestige loses the lease fast, high
     prestige stalls it indefinitely. The constants live in sim-config so
     tuning is a one-line change."
  - "seenLandlordStages initialized to [1] at createInitialPlayerSimState.
     This means day 1 always shows the first bubble even before
     progressLandlord has been called. The alternative (initialize to [])
     would require a synthetic 'first advance' in advanceFromSimDay on
     the first sim_day, which is uglier and couples the server to the
     message arc."
  - "Server calls progressLandlord BETWEEN resolveSlots and advanceDay, not
     inside either. This keeps progressLandlord a pure per-player step the
     server owns explicitly, matches the '04-03 drugs will reuse this hook'
     plan note, and keeps advanceDay's signature unchanged."
  - "Accent border on the last bubble uses both the Tailwind arbitrary-
     value class (border-[var(--color-accent)]) AND a sentinel class
     'accent-border' so the RTL test can regex for /accent/ without
     depending on Tailwind JIT compilation in the test environment."
metrics:
  duration: ~5min
  tasks: 2
  files_changed: 9
  tests_added: 13
  total_tests: 169
  completed: 2026-04-06
---

# Phase 4 Plan 02: Landlord Arc Summary

Landlord five-stage text-message arc with prestige gating using a pure
monotonic ratchet function called per player per sim_day. Low prestige
advances the arc; high prestige stalls it. Authored stage messages render
as iMessage-style WallLabel bubbles inside SimPanel, chronological with
an accent border on the most recent. Stage 5 is terminal. Proves the
per-day server progression hook that 04-03 (drugs) will reuse.

## What Shipped

### Task 1 — Type + sim-config + progressLandlord pure function (commit `ef3dbe0`)

**`src/types/game.ts`** — Added `LandlordStage = 1 | 2 | 3 | 4 | 5` and
extended `PlayerSimState` with two new fields:

```typescript
landlordStage: LandlordStage
seenLandlordStages: LandlordStage[]
```

Both are initialized by `createInitialPlayerSimState` to stage `1` and
`[1]` respectively (the seen list starts with stage 1 so day 1 always
has a visible bubble).

**`src/lib/sim-config.ts`** — Added:

```typescript
export const LANDLORD_CONFIG = {
  prestigeThresholds: [10, 25, 45, 70] as const,
} as const

export const LANDLORD_MESSAGES: Record<LandlordStage, string> = {
  1: 'hey just a heads-up, slight lease adjustment coming. nothing to worry about.',
  2: 'got a sec to grab coffee this week? want to walk through the new lease terms in person.',
  3: 'attaching the new lease. effective next month. let me know if questions.',
  4: 'renovation crew is in the building thurs–sun. please move all stock away from the south wall.',
  5: 'as discussed, lease terminates end of month. happy to recommend a relocation broker.',
}
```

Each message is one sentence, lowercase, zine register — no marketing
copy, no exclamation marks. The 5 authored strings cover the full 1→5
arc described in 04-CONTEXT.md (Landlord Arc decisions block).

**`src/lib/sim-engine.ts`** — New pure function:

```typescript
export function progressLandlord(
  playerSim: PlayerSimState,
  prestige: number,
): { updatedPlayerSim: PlayerSimState; advanced: boolean }
```

Behavior:
- `stage === 5` → terminal, no-op (`advanced: false`).
- `prestige >= LANDLORD_CONFIG.prestigeThresholds[stage - 1]` → stalled,
  no-op.
- Otherwise → advance to `stage + 1`, append to `seenLandlordStages`,
  `advanced: true`.

Monotonicity is enforced in the function: stages only move up. The only
writer is this function, so T-4-08 (tampering on landlordStage) holds
regardless of future callers. Purity confirmed — zero `Math.random /
Date.now / console.` in function bodies (all 4 matches are in comments).

`LANDLORD_CONFIG` and `LANDLORD_MESSAGES` are re-exported from sim-engine
so consumers can keep a single import module.

**`src/lib/sim-engine.test.ts`** — 8 new vitest cases:

1. `advances stage 1 → 2 when prestige is below thresholds[0]`
2. `does not advance when prestige meets or exceeds the threshold for the current stage`
3. `stage 5 is terminal (no-op regardless of prestige)` — tests both low and high prestige
4. `monotonicity: high prestige at a mid stage cannot lower the stage`
5. `all 5 stages reachable in 4 sequential calls when prestige stays at 0`
6. `stalls at stage 1 across many days when prestige stays high` (10-iteration soak)
7. `does not mutate the input playerSim (purity)` — deep JSON snapshot equality
8. `all 5 landlord messages are authored non-empty strings`

### Task 2 — Server wiring + LandlordMessages UI (commit `2a2a4fb`)

**`party/server.ts`** — Added `progressLandlord` to the sim-engine import
and inserted a per-player landlord step inside `advanceFromSimDay`,
placed AFTER the `resolveSlots` loop (so `updatedPlayerSimMap` is
populated) and BEFORE `advanceDay` (so the decay pass sees the advanced
state):

```typescript
for (const p of players) {
  const ps = updatedPlayerSimMap[p.sessionId]
  if (!ps) continue
  const { updatedPlayerSim: afterLandlord } = progressLandlord(ps, p.prestige)
  updatedPlayerSimMap[p.sessionId] = afterLandlord
}
```

`p.prestige` is read from the `PublicPlayer` projection, which is
server-authoritative (set only by engine paths in Phase 3/04-01) — no
client message can tamper with it (T-4-10 mitigation). The mutation is
per-player on `updatedPlayerSimMap` only, which flows into
`state.playerSim` via the existing `advanceDay` merge. No change to
`derivePublicState` (T-4-09: landlord state stays in PlayerSimState).

**`src/components/sim/LandlordMessages.tsx`** — New component. Props:

```typescript
export interface LandlordMessagesProps {
  playerSim: PlayerSimState | null
}
```

Renders `null` when `playerSim` is null or `seenLandlordStages` is
empty. Otherwise wraps the bubbles in a `<section data-landlord-messages>`
with a top border, a `WallLabel size="sm"` section header
`FROM: BUILDING MGMT`, and an `<ol>` of bubbles. Each `<li>` carries:

- `data-stage={stage}` for test targeting
- `border-2 rounded-2xl px-4 py-2 max-w-[75%] bg-paper` for iMessage-
  style shape
- Conditional border: `border-[var(--color-accent)] accent-border` on the
  last (newest) bubble, `border-ink` on the rest
- A `WallLabel size="sm"` containing `LANDLORD_MESSAGES[stage]`

The `accent-border` sentinel class is deliberate — the Tailwind
arbitrary-value class `border-[var(--color-accent)]` relies on JIT
compilation which is flaky in the RTL test environment, so the regex
`/accent/` in the test matches the sentinel reliably.

**`src/components/sim/LandlordMessages.test.tsx`** — 5 RTL cases:
- null `playerSim` → no `[data-stage]` elements
- `seenLandlordStages=[1]` → exactly 1 bubble, contains stage 1 text
- `seenLandlordStages=[1,2,3]` → 3 bubbles, last has accent, earlier
  ones do NOT
- `seenLandlordStages=[1,2,3,4]` → `data-stage` attributes in order
- Section header `FROM: BUILDING MGMT` present

**`src/components/sim/SimPanel.tsx`** — Imported `LandlordMessages` and
inserted it between `RelationshipPanel` and `NeighborhoodMap`, passing
only `playerSim={playerSim}` (never iterates `game.players` for opponents'
landlord state).

**`src/components/sim/SimPanel.test.tsx`** — Fixture backfilled with
`landlordStage: 1` and `seenLandlordStages: [1]` to match the new
`PlayerSimState` shape (Rule 3 auto-fix, committed with Task 1 so the
test file compiles during Task 1's type extension).

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run src/lib/sim-engine.test.ts` | 50/50 green (42 prior + 8 new) |
| `npx vitest run` (full regression) | **169/169 green** (156 prior + 13 new) |
| `grep -c "progressLandlord" src/lib/sim-engine.ts` | 2 |
| `grep -c "LANDLORD_MESSAGES" src/lib/sim-config.ts` | 1 |
| `grep -cE "Math\.random\|Date\.now\|console\." src/lib/sim-engine.ts` (in code, not comments) | 0 |
| `grep -c "progressLandlord" party/server.ts` | 3 |
| `grep -c "LandlordMessages" src/components/sim/SimPanel.tsx` | 2 |
| `grep -c "LANDLORD_MESSAGES" src/components/sim/LandlordMessages.tsx` | 3 |
| `grep -c "data-stage" src/components/sim/LandlordMessages.tsx` | 1 |
| `grep -c "landlordStage" src/types/game.ts` | 1 (plus LandlordStage type) |

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] SimPanel.test.tsx fixture missing new landlord fields**
- **Found during:** Task 1, first `tsc --noEmit` after the `PlayerSimState`
  extension with `landlordStage` and `seenLandlordStages`.
- **Issue:** The pre-existing SimPanel test constructs a literal
  `PlayerSimState`, which became a compile error the moment the interface
  gained two required fields.
- **Fix:** Added `landlordStage: 1, seenLandlordStages: [1]` to the
  fixture.
- **Files modified:** `src/components/sim/SimPanel.test.tsx`
- **Commit:** `ef3dbe0` (bundled with Task 1 so the task's tsc check could pass)

### Intentional design variances

**Section uses `<section>` with a top `border-t` instead of wrapping
`AppraisalForm`**
- RelationshipPanel wraps `AppraisalForm` because its contents are
  form-shaped rows. LandlordMessages is explicitly iMessage bubbles —
  wrapping them in an AppraisalForm (designed for labeled field rows)
  would fight the bubble layout. Instead I used a plain `<section>` with
  a top border divider and a `WallLabel size="sm"` header, which matches
  the zine register and keeps the bubble list as the dominant visual.

**Sentinel `accent-border` class on the newest bubble**
- The plan suggested `border-[var(--color-accent)]` as the accent. I kept
  that class AND added a sentinel `accent-border` class so the RTL test
  can regex for it without depending on the Tailwind JIT pipeline in the
  test environment. The visual effect is still delivered by the
  arbitrary-value class.

**`seenLandlordStages` initialized to `[1]` instead of `[]`**
- The plan said "`seenLandlordStages: LandlordStage[]` — chronological
  history; always starts [1]". I kept this explicitly in
  `createInitialPlayerSimState`. Rationale: it means day 1 always shows
  the first bubble even before `progressLandlord` has been called, which
  avoids a synthetic "first advance" in `advanceFromSimDay` on day 1.
  The alternative would couple the server to the message arc.

No architectural deviations. No auth gates. No checkpoints.

## Threat Mitigations Applied

| Threat | Status | Mechanism |
|--------|--------|-----------|
| T-4-08 (Tampering on landlordStage progression) | mitigate | `progressLandlord` is the only writer and enforces monotonicity internally (stage only goes up, never down); stage 5 is a no-op terminal. Client has no message type that touches the field. |
| T-4-09 (Information disclosure on landlordStage in public broadcast) | mitigate | `landlordStage` / `seenLandlordStages` live on `PlayerSimState`, which `derivePublicState` already strips (Phase 3 T-3-08 regression checked by existing test). No new public surface added in this plan. |
| T-4-10 (Client-claimed prestige to delay landlord) | mitigate | `progressLandlord` reads `p.prestige` from `PublicPlayer` inside `advanceFromSimDay`. `PublicPlayer.prestige` is set only by server/engine paths (Phase 3 public mirror projection), never from any client message. |
| T-4-11 (Stage advance not logged) | accept | Session-scoped game; `logSimTransaction` can be added in playtest tuning if needed. |

## Privacy Guarantees

- `LandlordMessages` receives only `playerSim` (this connection's private
  state). It never touches `game.players[i]` for any `i` and never
  iterates opponent sim state.
- `SimPanel` passes `playerSim` straight through — no opponent iteration.
- The server-side landlord mutation happens inside `advanceFromSimDay`
  on `updatedPlayerSimMap`, which is function-local, and is merged back
  into `state.playerSim` only. `landlordStage` / `seenLandlordStages`
  never reach `broadcastStateSecure` or `derivePublicState`.
- Each connection's `YOUR_SIM_STATE` message (broadcast via
  `broadcastSimStatePrivate`) carries only its own landlord state — the
  same per-connection lookup pattern Phase 3 established for `YOUR_HAND`.

## Known Stubs

None. All 5 stages are authored, all 5 are reachable in the test, the
server hook is live, and the UI renders from the authoritative playerSim
field. The plan's full behavior block is implemented.

## Commits

- `ef3dbe0` — feat(04-02): add landlord arc type + progressLandlord pure function
- `2a2a4fb` — feat(04-02): wire progressLandlord server step + LandlordMessages UI

## Self-Check: PASSED

Files exist:
- FOUND: src/types/game.ts (extended)
- FOUND: src/lib/sim-config.ts (extended)
- FOUND: src/lib/sim-engine.ts (extended)
- FOUND: src/lib/sim-engine.test.ts (extended)
- FOUND: src/components/sim/LandlordMessages.tsx
- FOUND: src/components/sim/LandlordMessages.test.tsx
- FOUND: src/components/sim/SimPanel.tsx (modified)
- FOUND: src/components/sim/SimPanel.test.tsx (modified)
- FOUND: party/server.ts (modified)

Commits exist:
- FOUND: ef3dbe0 (Task 1: type + config + engine + tests)
- FOUND: 2a2a4fb (Task 2: server wiring + UI)

Tests pass:
- FOUND: 169/169 vitest green (156 prior + 13 new)
- FOUND: tsc --noEmit exit 0

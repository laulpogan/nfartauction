---
phase: 03-core-sim-loop
plan: 04
subsystem: sim-ui
tags: [ui, sim-panel, aesthetic-primitives, neighborhood, phase-routing]
requirements: [SIM-04, SIM-05, SIM-06, SIM-07]
dependency_graph:
  requires:
    - src/hooks/useSim.ts (from 03-03)
    - src/stores/useSimSessionStore.ts (from 03-03)
    - src/lib/sim-config.ts (SLOT_DEFINITIONS, NEIGHBORHOOD_DEFINITIONS from 03-01)
    - src/types/game.ts (GamePhase, SimState, PlayerSimState, TimeSlot)
    - src/components/aesthetic/{WallLabel,Receipt,AppraisalForm}.tsx (Phase 2)
    - src/contexts/NeighborhoodContext.tsx (Phase 2)
  provides:
    - SimPanel (sim_day root UI)
    - StatDisplay, GlobalStatsBar, NeighborhoodMap, SlotPicker, DayResultReceipt
    - GamePage phase.type discriminated-union routing
  affects:
    - src/pages/GamePage.tsx (routing switch)
tech-stack:
  added: []
  patterns:
    - "All sim UI consumes Phase 2 primitives (WallLabel, AppraisalForm, Receipt, ReceiptRow) — no raw text spans for game copy"
    - "NeighborhoodProvider wraps SimPanel AND NeighborhoodMap so the --color-accent CSS variable flows to every child"
    - "SimPanel binds to useSim (not to raw zustand); zustand access inside tests goes through useSimSessionStore.setState wrapped in act()"
    - "GamePage routes by game.phase.type with an exhaustive switch; legacy phase=undefined rooms hit a defensive status-based fallback"
    - "Single source of truth for money: StatDisplay reads player.money (game.players[idx].money) — same field GameBoard uses via myMoney"
key-files:
  created:
    - src/components/sim/SimPanel.tsx
    - src/components/sim/StatDisplay.tsx
    - src/components/sim/SlotPicker.tsx
    - src/components/sim/NeighborhoodMap.tsx
    - src/components/sim/GlobalStatsBar.tsx
    - src/components/sim/DayResultReceipt.tsx
    - src/components/sim/SimPanel.test.tsx
    - src/components/sim/SlotPicker.test.tsx
  modified:
    - src/pages/GamePage.tsx
decisions:
  - "SlotPicker uses data-slot-type attribute on each button so tests can locate the 6 slot buttons without relying on label fragility"
  - "NeighborhoodMap exposes data-neighborhood-btn on each of 5 buttons for test targeting and DOM introspection"
  - "DayResultReceipt distinguishes a 'DAY SUBMITTED — WAITING FOR OTHERS' state (events=null) from 'DAY RESOLVED' (events populated) so the UI can render optimistically the moment hasSubmitted flips"
  - "SimPanel seeds selectedNeighborhood from playerSim.currentNeighborhood and syncs via useEffect so server-driven location changes (e.g. travel slot executed) rehydrate the accent"
  - "StatDisplay gracefully degrades when playerSim is null — renders only the Money row so first-connect before YOUR_SIM_STATE still has a meaningful panel"
metrics:
  duration: ~2.5min
  tasks: 2
  files_changed: 9
  tests_added: 10
  total_tests: 127
  completed: 2026-04-06
---

# Phase 3 Plan 04: SimPanel UI + GamePage Phase Routing Summary

Closes the sim-loop UI gap. Players now see a full sim_day screen — day header, art-market bar, personal stats appraisal, 5-neighborhood map with accent flow, 6-slot picker, draft list, and a SUBMIT DAY button — all built from Phase 2 primitives with zero raw text spans for game copy. GamePage routes by the `game.phase.type` discriminated union so the phase machine from 03-02 actually reaches the eyes.

## What Shipped

### Task 1 — Six sim UI components (commit `09b74ba`)

**`src/components/sim/StatDisplay.tsx`** — Wraps `AppraisalForm` with title "GALLERY APPRAISAL" / formNumber "FORM A-14". Renders MONEY (emphasis) from `player.money`, then COOLNESS / RESTEDNESS / LUCK from `playerSim`. If `playerSim` is null, shows only the MONEY row.

**`src/components/sim/GlobalStatsBar.tsx`** — Wraps `AppraisalForm` with title "ART MARKET". Four rows: HOTNESS (`Math.round(artMarketHotness*100)%`), GENTRIFICATION (`N / 10`), NFT HYPE (`N / 100`), DAY (`dayNumber`).

**`src/components/sim/NeighborhoodMap.tsx`** — Renders 5 buttons (gallery, warehouse, flatlands, hotel, online) inside a `NeighborhoodProvider` scoped to `selected`. Selected button gets `border-ink` + `bg-[var(--color-accent)]/10`; unselected get `border-rule text-ink-soft`. Each button is labeled via `WallLabel size="sm"` with `NEIGHBORHOOD_DEFINITIONS[id].label`.

**`src/components/sim/SlotPicker.tsx`** — Renders 6 buttons (one per `SLOT_DEFINITIONS` value). Each button shows the slot label (`WallLabel size="md"`), the description (`text-xs text-ink-soft`), and the money delta (`ReceiptRow label="MONEY" value="±N"`). Clicking calls `onAddSlot({ id: uuid(), type, neighborhood: currentNeighborhood })`. Buttons disable when `slotsRemaining === 0`. Below the grid, `draftSlots` render as a list with an aria-labeled × remove button per row.

**`src/components/sim/DayResultReceipt.tsx`** — Wraps `Receipt`. When `events=null`, renders header "DAY SUBMITTED" / subheader "WAITING FOR OTHERS". When events are passed (future SIM_DAY_RESULT wire-up), renders header "DAY RESOLVED" with a `ReceiptRow` per event. Both variants are `stamped`.

**`src/components/sim/SimPanel.tsx`** — Root sim_day component. Calls `useSim({ game, playerSim, sessionId, submitSlots })`, looks up the local player via `game.players.find(p => p.sessionId === sessionId)`, and early-returns `null` when `phase.type !== 'sim_day'`. Layout inside an outer `NeighborhoodProvider`:

1. Centered header: `DAY {sim.dayNumber}` + status line (`N SLOTS REMAINING` or `SUBMITTED — WAITING FOR OTHERS`)
2. `GlobalStatsBar`
3. `StatDisplay`
4. `NeighborhoodMap`
5. Conditional: `DayResultReceipt` (when `hasSubmitted`) OR `SlotPicker` + `SUBMIT DAY` button

Submit is disabled when `draftSlots.length === 0 || isSubmitting`.

**Tests (10 new cases):**

`SlotPicker.test.tsx` (4 cases):
- renders all 6 SLOT_DEFINITIONS as buttons
- clicking calls `onAddSlot` with the right type, correct neighborhood, and a non-empty uuid
- disables all slot buttons when `slotsRemaining === 0`
- draftSlots remove button calls `onRemoveSlot` with the id

`SimPanel.test.tsx` (6 cases):
- renders DAY label with the current day number
- renders all 6 slot picker buttons
- renders all 5 neighborhood buttons
- SUBMIT DAY is disabled when no draft slots
- SUBMIT DAY enables after seeding zustand draft inside `act()`
- renders Money from `player.money` (single-source-of-truth check: `$100,000`)

All tests use the Plan 02-02 framer-motion mock pattern (`motion` Proxy passthrough + `AnimatePresence` fragment).

### Task 2 — GamePage phase routing (commit `edd55ef`)

**`src/pages/GamePage.tsx`** extended:

1. Added `SimPanel` import
2. Destructured `playerSim` from `useGame` return
3. Replaced the `if (game.status === 'lobby')` branch with `const phase = game.phase` + exhaustive switch:
   - `phase.type === 'lobby'` → `WaitingRoom`
   - `phase.type === 'sim_day'` → `SimPanel` (gets `playerSim` and `actions.submitSlots`)
   - `phase.type === 'auction_round' | 'game_over'` → existing `GameBoard` (GameOverModal flow untouched)
4. Added a defensive `if (!phase) { ... }` fallback path that reproduces the pre-03-04 lobby-vs-GameBoard split, so any legacy persisted room that predates the phase field still renders something sane

The exhaustive switch satisfies TypeScript's discriminated-union narrowing — no `default` branch needed, which is exactly the safety net we want: adding a new phase variant in Phase 5 will immediately break `tsc` until this file handles it.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | **127/127 green** (117 prior + 10 new) |
| `npx vitest run src/components/sim/` | 10/10 green |
| `grep -c "SLOT_DEFINITIONS" src/components/sim/SlotPicker.tsx` | 3 |
| `grep -c "NeighborhoodProvider" src/components/sim/SimPanel.tsx` | 3 |
| `grep -c "AppraisalForm" src/components/sim/StatDisplay.tsx` | 2 |
| `grep -c "useSim" src/components/sim/SimPanel.tsx` | 2 |
| `grep -c "phase\.type" src/pages/GamePage.tsx` | 1 |
| `grep -c "SimPanel" src/pages/GamePage.tsx` | 2 (import + usage) |
| `grep -r "simWallet\|nftWallet" src/components/sim/` | 0 matches |

## Unified Money Proof (SIM-07)

Both paths resolve to the same underlying field on `GameState.players[idx].money`:

- **SimPanel/StatDisplay path:** `SimPanel.tsx` computes `const me = game?.players.find((p) => p.sessionId === sessionId)` and passes `player={me}` to `StatDisplay`. `StatDisplay.tsx` line 15 reads `formatMoney(player.money)`.
- **GameBoard path:** `src/hooks/useGame.ts` line 74: `const myMoney = game?.players[myPlayerIdx]?.money ?? 100000`. `GameBoard.tsx` line 53 renders `<WallLabel size="sm">{`$${myMoney.toLocaleString()}`}</WallLabel>`.

Both read `game.players[...].money` directly. No zustand copy, no separate sim wallet, no mirror field — SIM-07 enforced by construction.

## Deviations from Plan

### [Rule 3 - Blocking issue] React act() wrapping for zustand setState in SimPanel.test.tsx

- **Found during:** Task 1, first test run
- **Issue:** React 19 / Testing Library strict-act emits a warning and marks the test as not-yet-rendered when the test seeds `useSimSessionStore.setState({...})` without wrapping the setState in `act()`. The direct setState is the intended pattern from the plan (it says "set draftSlots via the zustand store directly"), but without `act()` the re-render does not flush before the assertion.
- **Fix:** Imported `act` from `@testing-library/react` and wrapped the `useSimSessionStore.setState(...)` call in `act(() => { ... })`. One test case only (the SUBMIT-enables case); the beforeEach reset does not need it because nothing is rendered yet when it runs.
- **Files modified:** `src/components/sim/SimPanel.test.tsx`
- **Commit:** `09b74ba` (Task 1)

### [Minor - test stability] data-attribute anchors on slot and neighborhood buttons

- **Found during:** Task 1, writing SlotPicker/SimPanel tests
- **Issue:** `screen.getAllByRole('button')` picks up the draft × remove buttons and the SUBMIT DAY button, and `getByText(label)` can collide with free-form WallLabel usage elsewhere in the panel.
- **Fix:** Added `data-slot-type={def.type}` to every SlotPicker button and `data-neighborhood-btn={id}` to every NeighborhoodMap button so tests filter on a stable, semantic anchor (`b.getAttribute('data-slot-type')`). No visual impact, better DOM introspection.
- **Commit:** `09b74ba` (Task 1)

No architectural deviations. No auth gates. No checkpoints.

## Threat Mitigations Applied

| Threat | Status | Mechanism |
|--------|--------|-----------|
| T-3-17 (addDraftSlot loop tampering) | mitigate | Every slot button has `disabled={slotsRemaining === 0}`; useSim already caps client-side; server Zod schema is the final gate |
| T-3-18 (opponent stats disclosure) | mitigate | StatDisplay only ever reads `player` (local) and `playerSim` (local). It never iterates `game.players` to render private fields. `grep -n "game.players" src/components/sim/StatDisplay.tsx` → 0 matches |
| T-3-19 (money display divergence) | mitigate | Proven above — StatDisplay reads `player.money`, the same field path GameBoard's myMoney resolves to |
| T-3-20 (client-generated slot uuids) | accept | Server does not trust these as authoritative identifiers |

## Privacy Guarantees

- `StatDisplay` receives only `player` (the local `PublicPlayer`) and `playerSim` (this connection's `PlayerSimState`). It never touches `game.players[i]` for `i !== me`.
- `SimPanel` narrows `me = game.players.find(p => p.sessionId === sessionId)` and returns `null` if `me` is missing, so an opponent can never accidentally get passed through.
- No sim UI path iterates `game.players` to read private sim fields — opponents' coolness/restedness/luck/currentNeighborhood are simply not on the `PublicPlayer` type, so any attempt would fail at compile time.

## Commits

- `09b74ba` — feat(03-04): build SimPanel and 5 sim subcomponents using Phase 2 primitives
- `edd55ef` — feat(03-04): route GamePage by game.phase.type — sim_day → SimPanel

## Known Stubs

**DayResultReceipt.events** is wired for `null` today. The real `SIM_DAY_RESULT` message handler (populating the events list and surfacing it to `SimPanel`) lands in a follow-up plan — the receipt already handles the events-populated branch, so wiring it is a one-line change in `useGame.ts`. This is a deliberate Phase 3 scoping decision, not a missed requirement.

## Self-Check: PASSED

Files exist:
- FOUND: src/components/sim/SimPanel.tsx
- FOUND: src/components/sim/StatDisplay.tsx
- FOUND: src/components/sim/SlotPicker.tsx
- FOUND: src/components/sim/NeighborhoodMap.tsx
- FOUND: src/components/sim/GlobalStatsBar.tsx
- FOUND: src/components/sim/DayResultReceipt.tsx
- FOUND: src/components/sim/SimPanel.test.tsx
- FOUND: src/components/sim/SlotPicker.test.tsx
- FOUND: src/pages/GamePage.tsx (modified)

Commits exist:
- FOUND: 09b74ba (Task 1: sim components)
- FOUND: edd55ef (Task 2: GamePage routing)

Tests pass:
- FOUND: 127/127 vitest green
- FOUND: tsc --noEmit exit 0

Acceptance greps:
- FOUND: SLOT_DEFINITIONS × 3 in src/components/sim/SlotPicker.tsx
- FOUND: NeighborhoodProvider × 3 in src/components/sim/SimPanel.tsx
- FOUND: AppraisalForm × 2 in src/components/sim/StatDisplay.tsx
- FOUND: useSim × 2 in src/components/sim/SimPanel.tsx
- FOUND: phase.type × 1 in src/pages/GamePage.tsx
- FOUND: SimPanel × 2 in src/pages/GamePage.tsx

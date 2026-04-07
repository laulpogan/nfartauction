---
phase: 03-core-sim-loop
plan: 02
subsystem: server
tags: [server, partykit, phase-machine, zod, privacy, timeout, submit-slots]
requirements: [SIM-01, SIM-09, SIM-10]
dependency_graph:
  requires:
    - src/types/game.ts (GamePhase, SimState, PlayerSimState, TimeSlot from 03-01)
    - src/lib/sim-engine.ts (resolveSlots, advanceDay from 03-01)
    - src/lib/sim-config.ts (SIM_CONFIG, createInitialPlayerSimState, createInitialSimState from 03-01)
    - party/server.ts InboundMessage discriminated union (from 01-02)
    - derivePublicState privacy pattern (from 01-01)
  provides:
    - party/server.ts phase machine (lobby → sim_day ↔ auction_round → game_over)
    - SUBMIT_SLOTS Zod variant + handler
    - advanceFromSimDay idempotent resolution
    - broadcastSimStatePrivate (per-connection YOUR_SIM_STATE)
    - 60s hard submission timeout via setTimeout
    - InboundMessageSchema export for schema unit tests
  affects:
    - STATE.md blockers (PartyKit 0.0.115 storage backend question documented in TODO)
tech-stack:
  added: []
  patterns:
    - "Extend-don't-replace Zod discriminated union (13th variant added)"
    - "Defer-then-resolve: SUBMIT_SLOTS stashes slots; all players resolve atomically in advanceFromSimDay"
    - "Idempotency guard (advancingFromSimDay flag) protects against timeout+last-submit race"
    - "Per-connection private channel mirrors YOUR_HAND for PlayerSimState"
    - "Phase-lifecycle timer (start on phase entry, clear on phase exit)"
key-files:
  created:
    - src/lib/server-schemas.test.ts
  modified:
    - party/server.ts
decisions:
  - "SUBMIT_SLOTS defers resolution — slots are stashed on PlayerSimState and only resolved in advanceFromSimDay (either on all-submitted or timeout). Guarantees all players see the world advance simultaneously."
  - "advancingFromSimDay flag + phase check guard against the last-submission/timeout race (T-3-11)"
  - "60s timeout implemented as setTimeout scoped to sim_day phase entry; onStart re-arms it if state is loaded mid-day"
  - "Drift for advanceDay hardcoded to zeros for now; a seeded PRNG will own this in a follow-up plan"
  - "Test file placed in src/lib/server-schemas.test.ts because vite.config.ts include glob is src/**; widening the glob was out of scope"
  - "InboundMessageSchema exported from party/server.ts as a colocated test surface — Zod schema is not secret"
  - "Single 'state' storage key retained; TODO comment references STATE.md blocker on PartyKit 0.0.115 SQLite vs KV question"
metrics:
  duration: ~12min
  tasks: 2
  files_changed: 2
  tests_added: 15
  total_tests: 105
  completed: 2026-04-06
---

# Phase 3 Plan 02: Server Phase Machine & SUBMIT_SLOTS Summary

Wired the server side of the Phase 3 sim loop. `party/server.ts` is now the trust boundary for every sim privacy and validation guarantee: it holds the per-player PlayerSimState map, validates SUBMIT_SLOTS via an extended Zod discriminated union, runs a 60-second hard submission timeout, and dispatches YOUR_SIM_STATE per connection. Plans 03-03 (client hook) and 03-04 (UI) consume this in the next wave.

## What Shipped

### Task 1 — Schema + phase machine + SUBMIT_SLOTS handler (commit `4b46eae`)

**Zod extension.** InboundMessage discriminated union gained a 13th variant:

```typescript
z.object({ type: z.literal('SUBMIT_SLOTS'), slots: z.array(TimeSlotSchema).max(20) })
```

With `TimeSlotSchema` enforcing `id` length 1–64, `type` in the 6 SlotType enum values, and `neighborhood` in the 5 Neighborhood values OR `null`. The 12 existing variants were left untouched. `InboundMessage as InboundMessageSchema` is re-exported for the colocated schema test.

**ServerState extension.** Two new fields:

```typescript
sim: SimState
playerSim: Record<string, PlayerSimState>
```

`onStart` backfills both for pre-Phase-3 persisted state, and also re-arms the submission timeout if the loaded phase is mid-`sim_day` (crash-recovery).

**JOIN wiring.** First-player branch initializes `playerSim` with `createInitialPlayerSimState(sessionId)`. New-player branch does the same. Reconnect branch sends `YOUR_SIM_STATE` from the owning connection's sim entry.

**START_GAME wiring.** After the existing `engine.startGame` call, the handler transitions `game.phase` to `{ type: 'sim_day', dayNumber: 1, submittedSessionIds: [] }`, calls `startSimDayTimeout()`, persists, broadcasts public state, and dispatches `broadcastSimStatePrivate()`. Sim happens BEFORE the first auction round — the Modern Art playbook for Phase 3.

**PLAY_CARD round-end transition.** After `endRound`, the handler now computes `nextPhase`: `game_over` if `finalGame.status === 'game_over'`, otherwise `{ type: 'sim_day', dayNumber: this.state.sim.dayNumber + 1, submittedSessionIds: [] }`. The timer is started or cleared accordingly.

**SUBMIT_SLOTS handler.** Implemented ahead of the Task 2 sequence boundary because the handler and its resolver function are tightly coupled:

1. Rejects with `ERROR` if `game.phase.type !== 'sim_day'`
2. Rejects with `ERROR` if sender's session is unknown
3. Rejects with `ERROR` if player has no sim state (defense in depth)
4. Stashes `msg.slots` on `state.playerSim[sessionId].scheduledSlots` — **does not resolve yet**
5. Adds sessionId to `game.phase.submittedSessionIds` (Set-deduped)
6. Broadcasts updated public state so other clients see who has submitted
7. Echoes the player's own updated `YOUR_SIM_STATE` back
8. If every active session has submitted, calls `advanceFromSimDay('all_submitted')`

**advanceFromSimDay(reason).** The atomic resolution point. Idempotent via `this.advancingFromSimDay` flag, double-guarded by `game.phase.type !== 'sim_day'` early return (so a stale timer firing post-transition is harmless).

For each player in position order:
- Look up `state.playerSim[p.sessionId]`
- Call `resolveSlots(playerSim, scheduledSlots ?? [], sim, player)` — empty arrays are no-ops, covering the timeout-no-submit case
- Mirror `updatedPlayerMoney` and `updatedPlayerSim.coolness` onto the public `GameState.players[]` entry
- Update `state.playerSim` with a fresh entry whose `scheduledSlots: []` (plan executed)

Then:
- Call `advanceDay(sim, allPlayerSims)` with zero drift (seeded PRNG comes later)
- Update `state.sim` and `state.game.sim`
- Transition `game.phase` to `{ type: 'auction_round', roundNumber: game.round }`
- Re-sync `Session.money` via the existing `syncSessions` helper
- Persist, broadcast public state, dispatch private sim state

**broadcastSimStatePrivate().** Iterates `room.getConnections()`, looks up `state.playerSim[conn.id]`, sends `{ type: 'YOUR_SIM_STATE', simState }` only when an entry exists. Mirrors the YOUR_HAND pattern.

**Timer lifecycle.** `startSimDayTimeout()` clears any existing timer then sets a fresh `setTimeout(advanceFromSimDay('timeout'), SIM_CONFIG.SUBMISSION_TIMEOUT_MS)`. `clearSimDayTimeout()` is called from `advanceFromSimDay` (via the idempotent guard), from the PLAY_CARD round-end branch on `game_over`, and implicitly through `startSimDayTimeout`'s clear-first behavior.

**onConnect.** After the existing YOUR_HAND send, also sends `YOUR_SIM_STATE` for the connecting player. Same pattern in JOIN reconnect branch.

### Task 2 — Zod schema tests (commit `b702bee`)

`src/lib/server-schemas.test.ts` — 15 test cases exercising `InboundMessageSchema.safeParse` against the SUBMIT_SLOTS variant:

**Positive:** 4-slot happy path, empty array (timeout no-op), neighborhood=null, all 6 slot types, all 5 neighborhoods.

**Negative (T-3-06 + T-3-10):** 21 slots (max cap), unknown `type: 'foo'`, unknown `neighborhood: 'mars'`, empty id, 65-char id, non-array slots, missing slots field.

**Regression guards:** JOIN, PLACE_OPEN_BID, PASS_SECOND_CARD still validate.

Imports `InboundMessageSchema` from `party/server`. The schema is not secret and clients must be able to craft valid messages, so exporting it for test surface is safe.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | **105/105 green** (90 prior + 15 new) |
| `grep -c "SUBMIT_SLOTS" party/server.ts` | 3 (Zod variant + handler + comment) |
| `grep -c "YOUR_SIM_STATE" party/server.ts` | 5 (onConnect, JOIN reconnect, SUBMIT_SLOTS echo, broadcastSimStatePrivate x2) |
| `grep -c "advanceFromSimDay" party/server.ts` | 5 (decl + timer + SUBMIT_SLOTS handler + comments) |
| `grep -c "advancingFromSimDay" party/server.ts` | 5 (decl + guard + flag set + finally + comment) |
| `grep -c "broadcastSimStatePrivate" party/server.ts` | 5 (decl + 4 call sites) |
| Privacy scan: `playerSim` inside `derivePublicState`/`broadcastStateSecure` body | 0 references (only a comment mentions the invariant) |

## Privacy Guarantees

The trust boundary between the server's `state.playerSim` map and the outside world is enforced by:

1. **`derivePublicState` never reads `state.playerSim`.** It destructures `game` only, and `GameState` has no reference to `playerSim` (which lives on `ServerState`, a level above `game`).
2. **`broadcastStateSecure` only emits `derivePublicState(game)`.** The `payload` it builds contains no `playerSim` reference.
3. **`broadcastSimStatePrivate` is the only path out.** It iterates connections and looks up `state.playerSim[conn.id]` — the owning session ID. A connection that is not a known player simply receives nothing.
4. **`SUBMIT_SLOTS` handler echoes the sender's updated sim only to the sender.** Other clients learn only that the session ID is now in `submittedSessionIds` (which is on the public phase).
5. **`advanceFromSimDay` broadcasts public state first, then dispatches private sim per connection.** No cross-contamination.

## Deviations from Plan

### [Sequence] SUBMIT_SLOTS handler + advanceFromSimDay implemented in Task 1 commit

- **Found during:** Task 1 execution
- **Issue:** The plan split the handler stub (Task 1) from the full handler + resolver (Task 2). In practice the handler is only useful once `advanceFromSimDay` exists, and vice versa, and the whole thing is compact enough that landing them atomically reads cleaner in the commit log.
- **Decision:** Committed the full phase machine + SUBMIT_SLOTS handler + `advanceFromSimDay` in Task 1's commit (`4b46eae`). Task 2's commit (`b702bee`) contains only the Vitest schema coverage. Task 2's `done` criteria all hold — the handler exists, resolution is idempotent, timer is wired, onStart restores mid-day timers, and 15 schema tests green.
- **Files modified:** party/server.ts only changed in Task 1's commit (Task 2 commit is test-only)

### [Rule 3 - Blocking issue] Test file placed in src/lib/ instead of party/

- **Found during:** Task 2 verification — first attempt placed the test at `party/server.test.ts` but Vitest did not pick it up.
- **Cause:** `vite.config.ts` has `test.include: ['src/**/*.test.{ts,tsx}']` so anything under `party/` is invisible to the test runner.
- **Fix:** Moved the test to `src/lib/server-schemas.test.ts` and imported `InboundMessageSchema` from `../../party/server`. Widening the include glob was rejected as out-of-scope for this plan (touches test infrastructure and affects test discovery semantics across the whole codebase).
- **Files modified:** `src/lib/server-schemas.test.ts` (final location), deleted the abandoned `party/server.test.ts`
- **Commit:** `b702bee` (test-only commit)

### [Rule 2 - Documentation] TODO comment for PartyKit storage backend

- **Found during:** Task 1
- **Issue:** Plan explicitly requested a TODO referencing the STATE.md blocker on PartyKit 0.0.115 SQLite vs KV storage limits.
- **Fix:** Added a multi-line TODO on the `ServerState` interface documenting the single-key strategy and the deferred split decision. No functional change.
- **Files modified:** party/server.ts
- **Commit:** `4b46eae`

No architectural deviations. No auth gates. No checkpoints.

## Threat Mitigations Applied

| Threat | Status | Mechanism |
|--------|--------|-----------|
| T-3-06 (SUBMIT_SLOTS tampering) | mitigated | Zod `discriminatedUnion` + TimeSlotSchema enums + max(20) |
| T-3-07 (SUBMIT_SLOTS spoofing) | mitigated | `sender.id` → `state.sessions[sessionId]` lookup; reject if not present |
| T-3-08 (playerSim info disclosure in GAME_STATE) | mitigated | `derivePublicState` + `broadcastStateSecure` never touch `state.playerSim` |
| T-3-09 (YOUR_SIM_STATE wrong recipient) | mitigated | `broadcastSimStatePrivate` iterates connections and looks up by `conn.id` only |
| T-3-10 (infinite slot array DoS) | mitigated | `.max(20)` Zod cap; Phase 1 onMessage already drops malformed JSON |
| T-3-11 (timeout vs all-submitted race) | mitigated | `advancingFromSimDay` flag + `phase.type !== 'sim_day'` early return in `advanceFromSimDay` |
| T-3-12 (money manipulation via SUBMIT_SLOTS) | mitigated | `resolveSlots` floors money at 0; `SLOT_DEFINITIONS` deltas are server constants; client sends slot *types*, not deltas |

## Known Stubs

None. The handler and resolver are wired end-to-end. Plans 03-03 (client hook) and 03-04 (UI) consume the messages this plan emits.

## Commits

- `4b46eae` — feat(03-02): extend server with phase machine, sim state, SUBMIT_SLOTS handler
- `b702bee` — test(03-02): Zod schema coverage for SUBMIT_SLOTS validation gate

## Self-Check: PASSED

Files exist:
- FOUND: /Users/laul_pogan/Source/nfartauction/app/party/server.ts (extended)
- FOUND: /Users/laul_pogan/Source/nfartauction/app/src/lib/server-schemas.test.ts

Commits exist:
- FOUND: 4b46eae (Task 1: phase machine + handler)
- FOUND: b702bee (Task 2: schema tests)

Tests pass:
- FOUND: 105/105 vitest green
- FOUND: tsc --noEmit exit 0

Acceptance greps:
- FOUND: SUBMIT_SLOTS × 3 in party/server.ts
- FOUND: YOUR_SIM_STATE × 5 in party/server.ts
- FOUND: advanceFromSimDay × 5 in party/server.ts
- FOUND: advancingFromSimDay × 5 in party/server.ts
- FOUND: broadcastSimStatePrivate × 5 in party/server.ts
- FOUND: 0 references to playerSim inside derivePublicState/broadcastStateSecure bodies

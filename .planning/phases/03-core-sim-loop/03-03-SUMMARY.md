---
phase: 03-core-sim-loop
plan: 03
subsystem: client-hooks-stores
tags: [client, hook, zustand, persist, ephemeral, react]
requirements: [SIM-08, SIM-09]
dependency_graph:
  requires:
    - src/hooks/useGame.ts (Phase 1 WebSocket hook pattern)
    - src/types/game.ts (PlayerSimState, TimeSlot, GamePhase from 03-01)
    - src/lib/sim-config.ts (SIM_CONFIG constants from 03-01)
    - party/server.ts (YOUR_SIM_STATE + SUBMIT_SLOTS from 03-02)
  provides:
    - useSim hook (composes useGame + zustand session store)
    - useSimSessionStore (ephemeral draft)
    - useSimPlayerStore + createSimPlayerStore (persisted, scoped)
    - useGame.playerSim + useGame.actions.submitSlots
  affects:
    - package.json (re-installed zustand@5)
tech-stack:
  added:
    - zustand@5 (re-activated; was dead-code removed in Phase 1)
  patterns:
    - "Server-authoritative sim state flows through useGame.useState; zustand holds only draft + persisted UI preferences"
    - "Persist middleware key scoped per room+session to avoid cross-room collisions in the same browser"
    - "Auto-clear draft on server-confirmed submission via effect watching playerSim.scheduledSlots length"
    - "Factory function (createSimPlayerStore) for scoped persistent stores instead of a global singleton"
key-files:
  created:
    - src/stores/useSimSessionStore.ts
    - src/stores/useSimPlayerStore.ts
    - src/stores/useSimSessionStore.test.ts
    - src/stores/useSimPlayerStore.test.ts
    - src/hooks/useSim.ts
  modified:
    - src/hooks/useGame.ts
    - package.json
    - package-lock.json
decisions:
  - "zustand only holds DRAFT + PERSISTED PREFERENCES — never authoritative server state, which stays in useGame useState slots"
  - "useSim takes useGame slices as arguments rather than calling useGame internally — lets consumers share one WebSocket connection across the whole tree"
  - "Auto-clear draft trigger: isSubmitting && playerSim.scheduledSlots.length===0 — the server resets scheduledSlots to [] in advanceFromSimDay after executing the plan, which is our signal"
  - "Persist key format sim-player:\${roomCode}:\${sessionId} isolates per-room per-player preferences in one localStorage namespace"
  - "Vitest 4 localStorage flakiness sidestepped via in-memory Storage shim stubbed per-test with vi.stubGlobal — no vite.config changes needed"
metrics:
  duration: ~5min
  tasks: 2
  files_changed: 7
  tests_added: 12
  total_tests: 117
  completed: 2026-04-06
---

# Phase 3 Plan 03: Client Hook + Zustand Stores Summary

Activated Zustand 5 as the official client-state library for sim UI, extended `useGame` to consume `YOUR_SIM_STATE` messages, and shipped a new `useSim` composing hook plus two Zustand stores. Plan 03-04 (SimPanel UI) now has a full ergonomic API: `sim`, `playerSim`, `draftSlots`, `slotsRemaining`, `hasSubmitted`, and slot actions, all wired to the server's authoritative sim state.

## What Shipped

### Task 1 — Zustand stores (commit `1ad3e80`)

**Re-installed zustand@5.** Phase 1 removed zustand as dead code; this plan re-activates it with a concrete purpose.

**`src/stores/useSimSessionStore.ts` — ephemeral.** No persist middleware. Holds:
```typescript
{
  draftSlots: TimeSlot[]
  isSubmitting: boolean
  addDraftSlot(slot), removeDraftSlot(id), clearDraft(), setSubmitting(v)
}
```
Wiped on reload, which is correct: the server is the source of truth for anything already submitted, and anything in the draft is pre-submission UI state only.

**`src/stores/useSimPlayerStore.ts` — persisted, scoped.** Uses `persist` middleware with `createJSONStorage(() => localStorage)`. Exports both:
- `createSimPlayerStore({ roomCode, sessionId })` — factory returning a hook with persist key `sim-player:${roomCode}:${sessionId}`
- `useSimPlayerStore` — default singleton for components without scope (real scoping happens inside `useSim` on mount)

State:
```typescript
{
  lastViewedDay: number
  preferredNeighborhood: Neighborhood | null
  tutorialDismissed: boolean
  setLastViewedDay(d), setPreferredNeighborhood(n), dismissTutorial()
}
```

**Tests (12 cases across both suites):**

`useSimSessionStore.test.ts` (6 cases): default state, addDraftSlot ordering, removeDraftSlot by id, removeDraftSlot no-op for unknown id, clearDraft reset, setSubmitting isolation from draftSlots.

`useSimPlayerStore.test.ts` (6 cases): defaults, setLastViewedDay, setPreferredNeighborhood, dismissTutorial, **scope isolation** (two different room+session pairs write to different localStorage keys and do not collide), **rehydration** (new store instance with same scope sees the prior persisted state).

### Task 2 — useGame extension + useSim (commit `3d0af24`)

**`src/hooks/useGame.ts`** extended in four places, zero existing behaviour touched:
1. Import `PlayerSimState`, `TimeSlot` from game types
2. New state slot: `const [playerSim, setPlayerSim] = useState<PlayerSimState | null>(null)`
3. Message handler: `if (msg.type === 'YOUR_SIM_STATE') setPlayerSim(msg.simState as PlayerSimState)`
4. Return object: `playerSim` + `actions.submitSlots: (slots) => send({ type: 'SUBMIT_SLOTS', slots })`

**`src/hooks/useSim.ts`** is the composing hook consumers call. Signature:
```typescript
useSim({
  game: GameState | null
  playerSim: PlayerSimState | null
  sessionId: string
  submitSlots: (slots: TimeSlot[]) => void
}) → {
  sim: SimState | null
  phase: GamePhase | null
  playerSim: PlayerSimState | null
  draftSlots: TimeSlot[]
  draftSlotCount: number
  slotsRemaining: number        // SIM_CONFIG.SLOTS_PER_DAY - draftSlots.length
  hasSubmitted: boolean         // phase.submittedSessionIds.includes(sessionId)
  isSubmitting: boolean
  actions: {
    addDraftSlot, removeDraftSlot, clearDraft, submitDraft
  }
}
```

Key mechanism — `submitDraft()` calls `setSubmitting(true)` and fires `submitSlots(draftSlots)`. A `useEffect` watches `playerSim` and, while `isSubmitting` is true, clears the draft the moment `playerSim.scheduledSlots.length === 0` (which is what the server's `advanceFromSimDay` leaves behind after executing the plan). The `isSubmitting` gate filters out the empty-initial-state case so we don't accidentally clear drafts that were never submitted.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | **117/117 green** (105 prior + 12 new) |
| `npx vitest run src/stores/` | 12/12 green |
| `grep "from 'zustand'" src/stores/useSimSessionStore.ts` | 1 match |
| `grep "persist" src/stores/useSimPlayerStore.ts` | 2 matches |
| `grep "YOUR_SIM_STATE" src/hooks/useGame.ts` | 1 match |
| `grep "playerSim" src/hooks/useGame.ts` | 4 matches (state, setter, return, type import) |
| `grep "submitSlots" src/hooks/useGame.ts` | 1 match (action wiring) |
| `grep "export function useSim" src/hooks/useSim.ts` | 1 match |
| `grep "createSimPlayerStore" src/stores/useSimPlayerStore.ts` | 3 matches |

## Deviations from Plan

### [Rule 3 - Blocking issue] Vitest 4 localStorage shim

- **Found during:** Task 1, first test run
- **Issue:** Vitest 4 ships with an experimental `--localstorage-file` flag that runs without a valid path by default under jsdom, so `localStorage.clear is not a function` at test time. The plan suggested `localStorage.clear()` in `beforeEach`, which would work on jsdom's native implementation but fails under Vitest 4's wrapper.
- **Fix:** Replaced `localStorage.clear()` with an in-memory `Storage` shim stubbed per-test via `vi.stubGlobal('localStorage', makeMemoryStorage())`. The shim implements getItem/setItem/removeItem/clear/key/length — the full `Storage` interface. This avoids touching `vite.config.ts` (out of scope) and gives us a deterministic, fully-isolated storage per test.
- **Files modified:** `src/stores/useSimPlayerStore.test.ts`
- **Commit:** `1ad3e80` (Task 1)

No architectural deviations. No auth gates. No checkpoints. Zero files outside plan scope were modified.

## Threat Mitigations Applied

| Threat | Status | Mechanism |
|--------|--------|-----------|
| T-3-13 (persist store tampering) | accept | Store contains only lastViewedDay + preferredNeighborhood + tutorialDismissed; no money, stats, or auth data lives in localStorage |
| T-3-14 (cross-tab disclosure) | accept | Same-origin sharing is intentional — two tabs of the same room show identical preferences |
| T-3-15 (message cast `as PlayerSimState`) | accept | Server (03-02 hardened) validates outbound messages by construction; message stream is trustworthy |
| T-3-16 (draftSlots unbounded) | mitigate | `slotsRemaining = SIM_CONFIG.SLOTS_PER_DAY - draftSlots.length` exposed for the 03-04 UI to enforce the add-button disable; server already Zod-caps at max(20) |

## Privacy Guarantees

- `useGame.playerSim` is the only source of the player's private sim state on the client; the type is `PlayerSimState | null` and the only writer is the `YOUR_SIM_STATE` message handler.
- `useSim` passes `args.playerSim` through unchanged — no zustand copy, no localStorage copy. The only state zustand owns is `draftSlots` (not authoritative) and `tutorialDismissed`-style preferences (not game state).
- No codepath in `useSim.ts` or the stores references other players' sim state. Opponents' private sim fields are unreachable from the client by construction (not just by convention).

## Commits

- `1ad3e80` — feat(03-03): activate zustand 5; add session and player sim stores
- `3d0af24` — feat(03-03): wire YOUR_SIM_STATE into useGame; add useSim composing hook

## Known Stubs

None. All exports are wired and ready for 03-04 SimPanel consumption.

## Self-Check: PASSED

Files exist:
- FOUND: /Users/laul_pogan/Source/nfartauction/app/src/stores/useSimSessionStore.ts
- FOUND: /Users/laul_pogan/Source/nfartauction/app/src/stores/useSimPlayerStore.ts
- FOUND: /Users/laul_pogan/Source/nfartauction/app/src/stores/useSimSessionStore.test.ts
- FOUND: /Users/laul_pogan/Source/nfartauction/app/src/stores/useSimPlayerStore.test.ts
- FOUND: /Users/laul_pogan/Source/nfartauction/app/src/hooks/useSim.ts
- FOUND: /Users/laul_pogan/Source/nfartauction/app/src/hooks/useGame.ts (extended)

Commits exist:
- FOUND: 1ad3e80 (Task 1: zustand activation + stores)
- FOUND: 3d0af24 (Task 2: useGame extension + useSim)

Tests pass:
- FOUND: 117/117 vitest green
- FOUND: tsc --noEmit exit 0

Acceptance greps:
- FOUND: YOUR_SIM_STATE × 1 in src/hooks/useGame.ts
- FOUND: playerSim × 4 in src/hooks/useGame.ts
- FOUND: submitSlots × 1 in src/hooks/useGame.ts
- FOUND: export function useSim × 1 in src/hooks/useSim.ts
- FOUND: createSimPlayerStore × 3 in src/stores/useSimPlayerStore.ts
- FOUND: persist × 2 in src/stores/useSimPlayerStore.ts

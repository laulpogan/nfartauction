---
phase: 05-nft-layer-end-state
plan: 02
subsystem: end-state-appraisal
tags: [end-state, sim-engine, server, ui, receipt, wall-label]
requirements: [END-01, END-02, END-03]
dependency_graph:
  requires:
    - src/types/game.ts (PlayerSimState, Faction, Neighborhood, Relationship)
    - src/lib/sim-engine.ts (deriveFactionAlignment, RELATIONSHIP_CONFIG, updateRelationship)
    - src/lib/sim-config.ts (createInitialPlayerSimState)
    - src/components/aesthetic/Receipt.tsx (Receipt + ReceiptRow primitives)
    - src/components/aesthetic/WallLabel.tsx (WallLabel primitive)
    - party/server.ts (PLAY_CARD round-end branch, advanceFromSimDay)
  provides:
    - FinalAppraisal interface + GameOverAppraisalsMessage stub
    - APPRAISAL_HEADER + APPRAISAL_TEMPLATES (11 clause keys)
    - computeFinalAppraisal pure function
    - ServerState.neighborhoodHistory + lastFinalAppraisals
    - GAME_OVER_APPRAISALS broadcast + onConnect replay
    - EndStateAppraisal React component
    - GameOverModal rewired to delegate to EndStateAppraisal
    - useGame.finalAppraisals state slice
  affects:
    - src/components/game/GameBoard.tsx (forwards finalAppraisals to modal)
    - src/pages/GamePage.tsx (forwards finalAppraisals to GameBoard)
    - src/hooks/useGame.ts (GAME_OVER_APPRAISALS message handler)
tech-stack:
  added: []
  patterns:
    - "Server-owned history tracking: neighborhoodHistory lives on ServerState
       as a Record<sessionId, Neighborhood[]>, written only inside
       advanceFromSimDay after resolveSlots. The pure sim-engine never sees
       the history — it's passed into computeFinalAppraisal explicitly.
       T-5-13 mitigation: no inbound message surfaces this field."
    - "Deterministic clause selection: computeFinalAppraisal picks index 0
       of each APPRAISAL_TEMPLATES bucket. Entropy, if needed, lives in the
       server caller — the engine stays pure (no Math.random / Date.now /
       console)."
    - "GAME_OVER broadcast is public by design: the appraisal IS the
       intentional end-state surface (CONTEXT.md: 'every player sees a
       printed appraisal document'). T-5-12 accepted, not mitigated."
    - "Reconnect replay: lastFinalAppraisals persists on ServerState so
       onConnect can replay GAME_OVER_APPRAISALS when game.status ===
       'game_over' (T-5-14)."
    - "EndStateAppraisal is null-safe on appraisals: when appraisals is
       null (broadcast missed), it falls back to rendering just the
       leaderboard + WINNER block so the component is still usable."
key-files:
  created:
    - src/components/game/EndStateAppraisal.tsx
    - src/components/game/EndStateAppraisal.test.tsx
    - src/components/game/GameOverModal.test.tsx
    - .planning/phases/05-nft-layer-end-state/05-02-SUMMARY.md
  modified:
    - src/types/game.ts
    - src/lib/sim-config.ts
    - src/lib/sim-engine.ts
    - src/lib/sim-engine.test.ts
    - src/components/game/GameOverModal.tsx
    - src/components/game/GameBoard.tsx
    - src/hooks/useGame.ts
    - src/pages/GamePage.tsx
    - party/server.ts
decisions:
  - "APPRAISAL_TEMPLATES is keyed by clause kind (faction/nft/flatlands)
     rather than by faction alone. This keeps the three-axis selection logic
     (one clause per axis) uniform and makes it trivial to add new axes
     later (e.g., 'risk:' or 'landlord:' buckets) without touching the
     computeFinalAppraisal core."
  - "dominantFaction is argmax over the derived factionMix with a strict
     greater-than comparison, so ties fall to the first iterated faction
     (painters). Null is returned only when every faction total is zero —
     the 'undeclared' template key handles this case explicitly."
  - "keyRelationships are sorted by abs(score) descending, so a dropped
     artist (score -50) ranks above a lukewarm 10. Status mapping:
     score < 0 → 'dropped', score < coldThreshold → 'cold', else 'kept'."
  - "neighborhoodHistory is appended ONCE per resolveSlots call, using the
     post-travel currentNeighborhood. That matches the plan's semantic: one
     entry per sim_day representing where the player ended the day. Drug
     acquisition / party use / landlord progression do not append — they
     don't change neighborhood."
  - "GameOverModal now delegates its entire body to EndStateAppraisal. The
     Modal shell remains for the open/title surface; the inner Receipt is
     owned by EndStateAppraisal. Makes the test surface cleaner (the
     EndStateAppraisal tests cover the full render, GameOverModal tests
     just verify wiring)."
metrics:
  duration: ~10min
  tasks: 2
  files_changed: 13
  tests_added: 23
  total_tests: 243
  completed: 2026-04-06
---

# Phase 5 Plan 02: End-State Appraisal Summary

The printed legacy document: after round 4 resolves, the server computes a
per-player FinalAppraisal from the server-tracked neighborhood history +
playerSim snapshot, broadcasts it to every connection as
`GAME_OVER_APPRAISALS`, and the client renders it through a Receipt +
WallLabel document that replaces the old inline GameOverModal scoreboard.
Closes END-01..END-03. The sim-engine stays absolutely pure; history
tracking lives on `ServerState.neighborhoodHistory`.

## What Shipped

### Task 1 — FinalAppraisal type + APPRAISAL_TEMPLATES + computeFinalAppraisal (commit `1719b99`)

**`src/types/game.ts`** — Added `FinalAppraisal` interface:

```typescript
export interface FinalAppraisal {
  sessionId: string
  displayName: string
  finalMoney: number
  factionMix: Record<Faction, number>
  dominantFaction: Faction | null
  neighborhoodsVisited: Neighborhood[]
  roundsInFlatlands: number
  nftExposure: { heldCount: number; walletBalance: number; unlocked: boolean }
  keyRelationships: {
    displayName: string
    score: number
    status: 'kept' | 'cold' | 'dropped'
  }[]
  threeSentenceEpitaph: string
}
```

Plus an outbound message stub mirroring the 05-01 pattern:

```typescript
export interface GameOverAppraisalsMessage {
  type: 'GAME_OVER_APPRAISALS'
  appraisals: Record<string, FinalAppraisal>
}
```

**`src/lib/sim-config.ts`** — Added `APPRAISAL_HEADER` constant and
`APPRAISAL_TEMPLATES: Record<string, string[]>` with 11 clause keys across
three axes:

- `faction:painters`, `faction:sculptors`, `faction:video_art`,
  `faction:social_political`, `faction:undeclared`
- `nft:no_chain`, `nft:casual_chain`, `nft:deep_chain`
- `flatlands:never_flatlands`, `flatlands:occasional_flatlands`,
  `flatlands:flatlands_native`

Each key holds 2 alternative zine-register phrasings. `sculptors` and
`social_political` buckets include a `{name}` interpolation token so the
per-player name can be woven in.

**`src/lib/sim-engine.ts`** — New `// ─── Phase 5 Plan 02: End-state appraisal
pure function ───` section implementing `computeFinalAppraisal`:

- factionMix from `deriveFactionAlignment(playerSim.relationships)`
- dominantFaction = argmax over factionMix (strict gt, null when all 0)
- neighborhoodsVisited = first-seen-order dedupe
- roundsInFlatlands = count of `'flatlands'` entries
- nftExposure = pass-through of heldNfts.length / nftWallet / unlocked
- keyRelationships = sorted by abs(score) desc, top 3, status mapped via
  `RELATIONSHIP_CONFIG.coldThreshold`
- threeSentenceEpitaph = three APPRAISAL_TEMPLATES picks (index 0 of each
  bucket) joined by a single space, with `{name}` → displayName

Zero `Math.random` / `Date.now` / `console` in the function body (verified
via grep — all 3 hits are in comments). `APPRAISAL_TEMPLATES` and
`APPRAISAL_HEADER` are re-exported from sim-engine alongside the existing
NFT_CONFIG block.

**`src/lib/sim-engine.test.ts`** — 11 new cases under `'End-state appraisal'`:

1. Returns a FinalAppraisal with all top-level fields populated
2. Selects dominantFaction as the argmax over factionMix
3. Returns null dominantFaction when all faction totals are zero
4. Dedupes neighborhoodsVisited preserving first-seen order
5. Counts roundsInFlatlands across the history
6. Sorts keyRelationships by abs-score and maps status (kept/cold/dropped)
7. Passes through nftExposure from playerSim
8. Epitaph has exactly three sentences ending in a period
9. Epitaph reflects the selected clause keys (deep_chain + flatlands_native)
10. Epitaph interpolates `{name}` for templates that include it
11. Is pure: does not mutate playerSim or neighborhoodHistory

All green (sim-engine.test.ts: 77 prior + 11 new = 88).

### Task 2 — Server round-4 transition + neighborhoodHistory + EndStateAppraisal UI (commit `d4e2f12`)

**`party/server.ts`** — `ServerState` gains two new fields:

```typescript
neighborhoodHistory: Record<string, Neighborhood[]>
lastFinalAppraisals?: Record<string, FinalAppraisal>
```

- **onStart** backfills `this.state.neighborhoodHistory = {}` for pre-05-02
  persisted state.
- **JOIN handler** initializes `neighborhoodHistory[sessionId] = []` in both
  the first-player branch and the new-player branch.
- **advanceFromSimDay** appends the post-travel `updatedPlayerSim.currentNeighborhood`
  onto `this.state.neighborhoodHistory[sessionId]` inside the existing
  `players.map` block — one append per resolveSlots call, server-only
  (T-5-13 mitigation).
- **onConnect** replays `GAME_OVER_APPRAISALS` to reconnecting players when
  `this.state.lastFinalAppraisals && this.state.game.status === 'game_over'`
  (T-5-14 mitigation).
- **PLAY_CARD round-end branch** — when `finalGame.status === 'game_over'`
  (engine's `endRound` flips this when round 4 completes), compute
  per-player `FinalAppraisal`:

```typescript
let finalAppraisals: Record<string, FinalAppraisal> | null = null
if (finalGame.status === 'game_over') {
  finalAppraisals = {}
  for (const p of finalGame.players) {
    const ps = this.state.playerSim[p.sessionId]
    if (!ps) continue
    finalAppraisals[p.sessionId] = computeFinalAppraisal({
      sessionId: p.sessionId,
      displayName: p.displayName,
      finalMoney: p.money,
      playerSim: ps,
      neighborhoodHistory: this.state.neighborhoodHistory[p.sessionId] ?? [],
    })
  }
  this.state.lastFinalAppraisals = finalAppraisals
}
```

Then broadcasts `GAME_OVER_APPRAISALS` to the room immediately after
`broadcastStateSecure` / `broadcastHands` / `ROUND_END`. T-5-11 mitigation:
this branch runs ONLY when the engine sets `game_over`, which is gated on
the cumulative round counter — no inbound message can force it.

**`src/components/game/EndStateAppraisal.tsx`** — New component, 135 lines:

```typescript
export interface EndStateAppraisalProps {
  game: GameState
  appraisals: Record<string, FinalAppraisal> | null
  myPlayerIdx: number
  onPlayAgain: () => void
}
```

Returns `null` when `game.status !== 'game_over'`. Otherwise renders a
stamped `Receipt` with:

1. **Header** = "PRINTED APPRAISAL", subheader = `APPRAISAL_HEADER`
   interpolated with the local player's displayName as the gallery name.
2. **WINNER block** — a large `WallLabel` with the top-money player's name
   + `DECLARED THE WINNER` subheader.
3. **Leaderboard** — players sorted by money desc, one `ReceiptRow` per
   player with label `${rank}. ${displayName.toUpperCase()}${isMe ? ' (YOU)' : ''}`
   and value `$${money.toLocaleString()}`. Closes END-03.
4. **Appraisal sections** (when `appraisals` provided) — one per player in
   leaderboard order, each with a `WallLabel` faction summary
   (`PAINTERS / NFT EXPOSURE: DEEP / FLATLANDS NATIVE`), the
   `threeSentenceEpitaph` as body text in `font-receipt`, and one
   `ReceiptRow` per key contact (`KEY CONTACT` label, `displayName: status`
   value).
5. **BACK TO LOBBY** gold Button calling `onPlayAgain`.

Defensive fallback: when `appraisals` is `null`, skip the sections entirely
— the leaderboard still renders.

**`src/components/game/EndStateAppraisal.test.tsx`** — 9 RTL cases:

1. Returns null when `game.status !== 'game_over'`
2. Renders WINNER block with top-money player
3. Renders one ReceiptRow per player sorted money desc
4. Marks local player with `(YOU)`
5. Renders one appraisal section per player when appraisals provided
6. Renders `threeSentenceEpitaph` text inside each section
7. Falls back to leaderboard-only when appraisals is null
8. BACK TO LOBBY button calls onPlayAgain on click
9. Renders key relationship rows when appraisal has keyRelationships

**`src/components/game/GameOverModal.tsx`** — Rewritten to delegate:

```typescript
export function GameOverModal({ game, appraisals, myPlayerIdx, onPlayAgain }) {
  return (
    <Modal open title="GAME OVER">
      <EndStateAppraisal
        game={game}
        appraisals={appraisals}
        myPlayerIdx={myPlayerIdx}
        onPlayAgain={onPlayAgain}
      />
    </Modal>
  )
}
```

**`src/components/game/GameOverModal.test.tsx`** — NEW (didn't exist before),
3 cases: null appraisals fallback, populated appraisals rendering, winner
display.

**`src/hooks/useGame.ts`** — New state slice
`finalAppraisals: Record<string, FinalAppraisal> | null`, populated by the
`GAME_OVER_APPRAISALS` handler in the `socket.addEventListener('message')`
branch. Surfaced in the returned hook object alongside `roundEndResult`.

**`src/pages/GamePage.tsx`** — Pulls `finalAppraisals` from `useGame` and
forwards it to both `GameBoard` call sites (the defensive legacy branch +
the `auction_round`/`game_over` case).

**`src/components/game/GameBoard.tsx`** — New optional prop
`finalAppraisals?: Record<string, FinalAppraisal> | null` (defaulting to
`null`), forwarded to `<GameOverModal appraisals={finalAppraisals} ... />`.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run src/lib/sim-engine.test.ts` | 88/88 green (77 prior + 11 new) |
| `npx vitest run` (full regression) | **243/243 green** (220 prior + 23 new) |
| `grep -c "computeFinalAppraisal" src/lib/sim-engine.ts` | 3 (≥1) |
| `grep -c "APPRAISAL_TEMPLATES" src/lib/sim-config.ts` | 2 (≥1) |
| `grep -c "computeFinalAppraisal" party/server.ts` | 4 (≥1) |
| `grep -c "neighborhoodHistory" party/server.ts` | 10 (≥4) |
| `grep -c "GAME_OVER_APPRAISALS" party/server.ts` | 2 (≥2) |
| `grep -c "EndStateAppraisal" src/components/game/GameOverModal.tsx` | 2 (≥2) |
| `grep -nE "Math\.random\|Date\.now\|console\." src/lib/sim-engine.ts` (in code) | 0 (all matches in comments) |

## Deviations from Plan

None — plan executed as written. No auth gates, no checkpoints, no
architectural deviations. Two minor notes:

- **GameOverModal.test.tsx did not previously exist** — the plan says
  "Update existing tests" but there was no file. Created from scratch with
  3 cases covering the new wiring (null fallback, populated appraisals,
  winner display). This matches the plan's intent.
- **The plan example deletes the `let` assignment around `item`** — I kept
  the server-side flow exactly as the 05-01 PURCHASE_NFT_WHITELIST handler
  wrote it and inserted the game_over block AFTER the existing
  `ROUND_END` broadcast, so the order is: state broadcast → hands → round
  end → game-over appraisals. This preserves the existing invariant that
  `GAME_STATE` lands before any round-tied follow-ups.

## Threat Mitigations Applied

| Threat | Status | Mechanism |
|--------|--------|-----------|
| T-5-11 (mid-game appraisal leak) | mitigate | computeFinalAppraisal called ONLY inside PLAY_CARD round-end branch gated on `finalGame.status === 'game_over'`. Engine sets status only when round 4 ends. No inbound message can force this path. |
| T-5-12 (playerSim leakage via appraisal) | accept | Appraisal IS the intentional public summary at game end (CONTEXT.md). Sessions reset on lobby return — no private sim state survives between games. |
| T-5-13 (client-supplied neighborhoodHistory) | mitigate | neighborhoodHistory is a server-only `Record<string, Neighborhood[]>` on ServerState. Written ONLY inside advanceFromSimDay after resolveSlots. No inbound message touches it. |
| T-5-14 (reconnecting player misses appraisal) | mitigate | `lastFinalAppraisals` persists on ServerState; onConnect replays GAME_OVER_APPRAISALS when `game.status === 'game_over'`. |
| T-5-15 (computeFinalAppraisal cost) | accept | O(relationships=10) + O(history ≤ 4) + O(templates = 3 picks) per player × ≤ 5 players = ~200 ops per round-4 transition. Negligible. |
| T-5-16 (game-over phase forced by client) | mitigate | `nextPhase = { type: 'game_over' }` only when `finalGame.status === 'game_over'`, which is set by engine's `endRound` based on cumulative round counter. No inbound message can flip this. |

## Privacy Guarantees

- `neighborhoodHistory` is never serialized into `derivePublicState` — the
  public projection strips `deck` + `auction.sealedBids` but leaves the
  rest of `GameState`, and `neighborhoodHistory` lives on `ServerState`,
  not `GameState`.
- `FinalAppraisal` broadcast is intentionally public (CONTEXT.md design).
  It carries aggregated summaries — faction mix totals, neighborhood list,
  nftExposure counts, and the top-3 key relationships — NOT raw
  `relationships[]` or `drugs[]` or `seenLandlordStages`. Private
  transactional state stays private even through the end-state surface.
- The `keyRelationships` list is capped at 3 entries, so even a deep
  relationship graph does not leak its entirety.
- Reconnect replay unicasts the same broadcast payload to the connecting
  socket — it does not add any private fields.

## Known Stubs

None. All paths are live: computeFinalAppraisal has full test coverage;
the server computes + broadcasts + replays on reconnect; EndStateAppraisal
renders the Receipt + WallLabel document with leaderboard + per-player
sections; GameOverModal delegates; GAME_OVER_APPRAISALS flows through
useGame → GamePage → GameBoard → GameOverModal → EndStateAppraisal.

## Commits

- `1719b99` — feat(05-02): add FinalAppraisal type, APPRAISAL_TEMPLATES, computeFinalAppraisal
- `d4e2f12` — feat(05-02): wire game_over transition + EndStateAppraisal UI

## Self-Check: PASSED

Files exist:
- FOUND: src/types/game.ts (extended)
- FOUND: src/lib/sim-config.ts (extended)
- FOUND: src/lib/sim-engine.ts (extended)
- FOUND: src/lib/sim-engine.test.ts (extended)
- FOUND: src/components/game/EndStateAppraisal.tsx
- FOUND: src/components/game/EndStateAppraisal.test.tsx
- FOUND: src/components/game/GameOverModal.tsx (rewritten)
- FOUND: src/components/game/GameOverModal.test.tsx (new)
- FOUND: src/components/game/GameBoard.tsx (modified)
- FOUND: src/hooks/useGame.ts (modified)
- FOUND: src/pages/GamePage.tsx (modified)
- FOUND: party/server.ts (modified)

Commits exist:
- FOUND: 1719b99 (Task 1: types + config + engine + tests)
- FOUND: d4e2f12 (Task 2: server + EndStateAppraisal + rewire)

Tests pass:
- FOUND: 243/243 vitest green (220 prior + 11 sim-engine + 9 EndStateAppraisal + 3 GameOverModal)
- FOUND: tsc --noEmit exit 0

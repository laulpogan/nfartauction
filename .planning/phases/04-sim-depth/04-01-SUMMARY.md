---
phase: 04-sim-depth
plan: 01
subsystem: relationships
tags: [relationships, sim-engine, types, ui, faction, dropped-artist]
requirements: [DEPTH-01, DEPTH-02, DEPTH-03, DEPTH-09, DEPTH-10]
dependency_graph:
  requires:
    - src/types/game.ts (Phase 3 PlayerSimState, TimeSlot)
    - src/lib/sim-engine.ts (Phase 3 resolveSlots, advanceDay)
    - src/components/aesthetic/AppraisalForm.tsx (Phase 2)
    - src/components/aesthetic/WallLabel.tsx (Phase 2)
    - party/server.ts (Phase 3 advanceFromSimDay, START_GAME handler)
  provides:
    - Relationship, Faction, RelationshipCharacterKind types
    - RELATIONSHIP_CONFIG, RELATIONSHIP_DEFINITIONS (5 artists + 5 collectors)
    - decayRelationships, updateRelationship, deriveFactionAlignment,
      deriveBidLikelihoodModifiers, deriveCredibilityPenalty, seedDroppedArtist
    - ResolveSlotsResult.contactedThisDay (Set<string>)
    - advanceDay(sim, sims, drift?, contactedByPlayer?) new parameter
    - RelationshipPanel UI component
  affects:
    - src/components/sim/SimPanel.tsx (renders RelationshipPanel between
      StatDisplay and NeighborhoodMap)
    - party/server.ts (JOIN seeds dropped artist via server RNG;
      advanceFromSimDay builds contactedByPlayer Map)
    - src/components/sim/SimPanel.test.tsx (PlayerSimState fixture updated)
tech-stack:
  added: []
  patterns:
    - "Server-owned entropy: Math.random for dropped-artist seed lives in
       party/server.ts, NOT sim-engine. The engine exposes a pure
       seedDroppedArtist(playerSim, artist) helper that the server calls."
    - "Derived, never stored: Faction alignment is computed via
       deriveFactionAlignment on read. PlayerSimState intentionally has no
       `faction` field — writing `playerSim.faction = …` is a compile error."
    - "Per-day contact routing: resolveSlots returns contactedThisDay; the
       server collects all sets into a Map keyed by sessionId and passes it
       to advanceDay → decayRelationships."
    - "Snap floor on decay: exponential decay asymptotes, so scores below 1
       snap to 0 so a 'dead' relationship is visibly dead."
key-files:
  created:
    - src/components/sim/RelationshipPanel.tsx
    - src/components/sim/RelationshipPanel.test.tsx
  modified:
    - src/types/game.ts
    - src/lib/sim-config.ts
    - src/lib/sim-engine.ts
    - src/lib/sim-engine.test.ts
    - src/components/sim/SimPanel.tsx
    - src/components/sim/SimPanel.test.tsx
    - party/server.ts
decisions:
  - "Dropped artist seed at JOIN (not START_GAME) — each player gets their
     dropped artist the moment they enter the lobby. This also means reconnect
     replays hit a stable relationship shape."
  - "characterId format 'artist:<artistId>' mirrors the Artist enum so server
     seed, engine derivation, and UI lookups all use the same string key."
  - "deriveBidLikelihoodModifiers returns Record<characterId, number> keyed by
     the full characterId (not by Artist). The auction layer adapter that
     consumes this lands in a later plan."
  - "Faction field removed from PlayerSimState entirely. The plan specified
     `faction?: never` but that still allows `faction: undefined`; omitting
     the property entirely is cleaner and catches writes at compile time."
  - "Snap floor (score < 1 → 0) inside decayRelationships: exponential decay
     never reaches zero mathematically, so the plan's 'floors non-dropped at 0'
     invariant needs a discrete snap to be observable."
metrics:
  duration: ~7min
  tasks: 2
  files_changed: 9
  tests_added: 29
  total_tests: 156
  completed: 2026-04-06
---

# Phase 4 Plan 01: Relationships + Dropped Artist Summary

Replaced the Phase 3 `relationships: never[]` stub with a full named-character
relationship system. Players now carry 10 relationships (5 artists mirroring
the 5 auction artists + 5 authored collectors with gallery bios), decay
exponentially per uncontacted sim day, and feed into a bid-likelihood
modifier for the auction layer. At lobby join, the server randomly seeds one
of the 5 artists as "the artist you shouldn't have dropped" with a -50 score
and a passive Credibility penalty proportional to that artist's cumulative
round value. Faction alignment is a derived stat block computed on read.

## What Shipped

### Task 1 — Type layer + character data + pure engine functions (commit `e555df1`)

**`src/types/game.ts`** — Added `Faction`, `RelationshipCharacterKind`, and
`Relationship` interfaces. Replaced `relationships: never[]` with
`relationships: Relationship[]` on `PlayerSimState`, added a
`droppedArtist: Artist | null` quick-lookup mirror, and removed the
`faction: null` stub (faction is derived, never stored). Extended `TimeSlot`
with optional `targetCharacterId` (documented as honored only by
studio_visits / opening / art_fair).

**`src/lib/sim-config.ts`** — Added `RELATIONSHIP_CONFIG` (decayFactor 0.85,
coldThreshold 25, bidModMaxAbs 0.15, droppedSeedScore -50, credibilityScale
0.05, initialScore 50) and `RELATIONSHIP_DEFINITIONS`: 5 artists
(`artist:lite_metal` etc., each mirroring the auction `Artist` enum, with
distinct faction assignments — Lite Metal/Karl Gitter → painters, Yoko →
social_political, Christine P. → sculptors, Krypto → video_art) and 5
collectors (Helena V., Bram K., Margot R., Tobias O., Inez M.) with
one-sentence gallery-bio descriptions distributed across all four factions.
`createInitialPlayerSimState` deep-clones `RELATIONSHIP_DEFINITIONS` so
players never share relationship array references.

**`src/lib/sim-engine.ts`** — Six new pure functions:

```typescript
decayRelationships(rels, contactedIds, currentDay) → Relationship[]
updateRelationship(rels, characterId, scoreDelta) → Relationship[]
deriveFactionAlignment(rels) → Record<Faction, number>
deriveBidLikelihoodModifiers(rels) → Record<string, number>
deriveCredibilityPenalty(rels, roundValues) → { penalty, droppedArtist }
seedDroppedArtist(playerSim, artist) → PlayerSimState
```

Key invariants:
- `decayRelationships` skips contacted IDs, applies `score * 0.85` to the
  rest with a snap floor (`< 1 → 0`), and freezes the dropped artist score
  at -50 while still ticking its decayTimer.
- `updateRelationship` clamps to `[-50, 100]` (dropped range), resets
  decayTimer to 0 on positive delta, and silently no-ops on unknown
  characterIds (T-4-01 defense in depth).
- `deriveBidLikelihoodModifiers` returns +0.10..+0.15 linear for score ≥75,
  -0.10..-0.15 linear for cold scores 0..25, 0 for neutral band, and always
  -0.15 for the dropped artist.
- `deriveCredibilityPenalty` = `-round(roundValues[droppedArtist] * 0.05)`.

`resolveSlots` extended: tracks `contactedThisDay: Set<string>` locally, and
when a slot has `targetCharacterId` AND slot type is studio_visits (+8),
opening (+8), or art_fair (+12), calls `updateRelationship`, adds to
`contactedThisDay`, and emits a `'relationship'` SimEvent. `contactedThisDay`
is returned as a new field on `ResolveSlotsResult`.

`advanceDay` extended with optional `contactedByPlayer?: Map<string, Set<string>>`
parameter. Calls `decayRelationships` per playerSim against its contact set
(or empty if not provided — treats as "nobody called today"). Backwards
compatible.

**Purity preserved**: `grep -nE "Math\.random|Date\.now|console\."` in
sim-engine.ts shows 3 matches, all in comments (none in function bodies).

**`src/lib/sim-engine.test.ts`** — 22 new vitest cases across
`decayRelationships`, `updateRelationship`, `deriveFactionAlignment`,
`deriveBidLikelihoodModifiers`, `deriveCredibilityPenalty`, `seedDroppedArtist`,
`resolveSlots with targetCharacterId`, and `advanceDay with contactedByPlayer`.
The pre-existing "passes player sims through unchanged" test was updated
because advanceDay now decays relationships by default.

### Task 2 — Server seed + RelationshipPanel UI (commit `95d4aee`)

**`party/server.ts`** — Three changes:

1. `TimeSlotSchema` gains `targetCharacterId: z.string().min(1).max(64).optional()`
   (T-4-01 mitigation — engine also silently no-ops unknown IDs).
2. New `seedFreshPlayerSim(sessionId)` helper picks one of the 5 `ARTISTS`
   uniformly via `Math.random` (server-owned entropy) and calls the pure
   `seedDroppedArtist` helper from sim-engine. Both JOIN call sites (first
   player + subsequent lobby join) now use this helper.
3. `advanceFromSimDay` captures `contactedThisDay` from each per-player
   `resolveSlots` call into a local `Map<sessionId, Set<string>>`, passes it
   to `advanceDay`, and merges the decayed relationship state back into
   `state.playerSim`. The Map is function-local and never broadcast
   (T-4-05: server-derived from engine output, not trusted client input).

**`src/components/sim/RelationshipPanel.tsx`** — New component. Props:
`{ playerSim: PlayerSimState | null, roundValues: Record<Artist, number> | null }`.
Returns `null` when `playerSim` is null. Otherwise wraps `AppraisalForm` with
title `CONTACTS` / formNumber `FORM C-22` and renders:

- One `AppraisalRow` per relationship, anchored via `data-relationship-id`,
  showing rounded score plus an inline `Chip` (bordered WallLabel span)
  with `data-cold` (score < 25, non-dropped) or `data-dropped`
  (isDroppedArtist). Chips are zine-register (no color, no emoji).
- A FACTION row with `data-faction-summary`, derived on-the-fly via
  `deriveFactionAlignment`, formatted as `PAINTERS N / SCULPTORS N /
  VIDEO N / SOCIAL/POL N`.
- A CREDIBILITY row (emphasized) rendered only when
  `deriveCredibilityPenalty` returns a non-zero penalty, with
  `data-credibility-penalty={penalty}` for test anchors.

**`src/components/sim/RelationshipPanel.test.tsx`** — 7 RTL cases:
- renders one row per relationship (10 characters)
- COLD chip appears when score < 25
- DROPPED chip appears for `isDroppedArtist`, and dropped artist does NOT
  get a duplicate COLD chip
- CREDIBILITY row is negative when dropped artist has market value
- CREDIBILITY row hidden when no dropped artist
- FACTION summary row always present
- returns null when playerSim is null

**`src/components/sim/SimPanel.tsx`** — Imports `RelationshipPanel` and
renders it between `StatDisplay` and `NeighborhoodMap`, passing
`playerSim={playerSim}` and `roundValues={game?.roundValues ?? null}`.

**`src/components/sim/SimPanel.test.tsx`** — Fixture updated: removed
`faction: null`, added `droppedArtist: null` to match the new
`PlayerSimState` shape.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run src/lib/sim-engine.test.ts` | 42/42 green |
| `npx vitest run` (full regression) | **156/156 green** (127 prior + 29 new) |
| `grep -c "RELATIONSHIP_DEFINITIONS" src/lib/sim-config.ts` | 3 |
| `grep -c "decayRelationships" src/lib/sim-engine.ts` | 4 |
| `grep -cE "Math\.random\|Date\.now" src/lib/sim-engine.ts` (bodies) | 0 |
| `grep -c "isDroppedArtist" src/types/game.ts` | 2 |
| `grep -c "isDroppedArtist" src/lib/sim-config.ts` | 10 |
| `grep -c "isDroppedArtist" src/lib/sim-engine.ts` | 5 |
| `grep -c "seedDroppedArtist" party/server.ts` | 3 |
| `grep -c "contactedByPlayer" party/server.ts` | 3 |
| `grep -c "RelationshipPanel" src/components/sim/SimPanel.tsx` | 2 |
| `grep -c "AppraisalForm" src/components/sim/RelationshipPanel.tsx` | 2 |
| `grep -c "data-relationship-id" src/components/sim/RelationshipPanel.tsx` | 1 |
| Privacy scan: `playerSim` refs inside `derivePublicState` body | 0 |

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] decayRelationships floor never reaches 0**
- **Found during:** Task 1, `floors non-dropped score at 0` test run
- **Issue:** `Math.max(0, score * 0.85)` asymptotes — the plan's invariant
  "score floors at 0" was mathematically unreachable, leaving tiny residuals
  like `0.0001478...` after 50 iterations.
- **Fix:** Added a hard snap: `if (decayed < 1) → 0`. A sub-1 score is
  visually "gone" anyway, so snapping makes the dead state observable.
- **Files modified:** `src/lib/sim-engine.ts`
- **Commit:** `e555df1`

**2. [Rule 3 - Blocking] SimPanel.test.tsx fixture uses old faction: null shape**
- **Found during:** Task 1, first `tsc --noEmit` after the PlayerSimState
  type change.
- **Issue:** The pre-existing SimPanel test built a literal `PlayerSimState`
  with `faction: null`, which is now a compile error because the field was
  removed entirely (faction is derived).
- **Fix:** Replaced `faction: null` with `droppedArtist: null` in the
  fixture to match the new shape.
- **Files modified:** `src/components/sim/SimPanel.test.tsx`
- **Commit:** `e555df1`

**3. [Rule 1 - Bug] Pre-existing advanceDay test asserted pass-through**
- **Found during:** Task 1, test run after adding advanceDay decay logic.
- **Issue:** The Phase 3 test `passes player sims through unchanged` used
  `expect(updatedPlayerSims).toEqual([a, b])`, which now fails because
  decay runs by default.
- **Fix:** Rewrote the test as `decays relationships by default when no
  contact set is provided (Phase 4)` — asserts non-relationship fields are
  preserved and the relationships decayed by the expected 0.85 factor.
- **Files modified:** `src/lib/sim-engine.test.ts`
- **Commit:** `e555df1`

### Intentional design variances

**Faction field removed (not `faction?: never`)**
- The plan specified `faction?: never` to make writes a compile error while
  keeping the field as a derived hint. I removed the field entirely instead.
  Rationale: `faction?: never` still permits `faction: undefined` literals,
  and the property appearing in type lists is noise. The public API is
  `deriveFactionAlignment(relationships)` — a call, not a field. Cleaner.

**Dropped artist seed at JOIN (not START_GAME)**
- The plan said "after every player's createInitialPlayerSimState call" and
  specifically mentioned the START_GAME handler. Each player's
  `createInitialPlayerSimState` is actually called in the JOIN handler, so
  seeding at JOIN is where the plan's intent lands. Each player gets their
  dropped artist the moment they enter the lobby, and reconnect replays
  hit a stable relationship shape.

**`characterId` prefix scheme (`artist:<artistId>` / `collector:<slug>`)**
- The plan hinted at this format but left it as "Claude's discretion." I
  used colon-prefixed strings so the dropped-artist seed, engine lookups,
  and UI keys all share one canonical form, and so the slot-level
  `targetCharacterId` can be mapped back to an `Artist` enum value by
  string prefix stripping (see `deriveCredibilityPenalty`).

No architectural deviations. No auth gates. No checkpoints.

## Threat Mitigations Applied

| Threat | Status | Mechanism |
|--------|--------|-----------|
| T-4-01 (Tampering on TimeSlot.targetCharacterId) | mitigate | Zod schema caps at `z.string().min(1).max(64).optional()`; engine `updateRelationship` silently no-ops on unknown IDs; resolveSlots only honors the field for studio_visits / opening / art_fair. |
| T-4-02 (updateRelationship score range tampering) | mitigate | `clamp(score, -50, 100)` inside the pure function regardless of input. |
| T-4-03 (playerSim.relationships in broadcast) | mitigate | `derivePublicState` strips playerSim entirely (Phase 3 T-3-08); `grep -B2 -A20 "function derivePublicState" party/server.ts \| grep -c playerSim = 0`. |
| T-4-04 (dropped artist seed tampering) | mitigate | `seedFreshPlayerSim` lives in server only; `Math.random` is NOT in sim-engine; client has no input that controls which artist is dropped. |
| T-4-05 (spoofed contact with non-slotted character) | mitigate | `advanceFromSimDay` builds `contactedByPlayer` from `resolveSlots.contactedThisDay`, which is server-derived from the engine's execution of the slot plan — not from any client-supplied field. |
| T-4-06 (relationship audit log) | accept | Session-scoped game; no cross-session audit. |
| T-4-07 (huge relationships array DoS) | accept | Fixed at 10 by `RELATIONSHIP_DEFINITIONS`; clients cannot grow it. |

## Privacy Guarantees

- `RelationshipPanel` receives only `playerSim` (this connection's private
  state) and `roundValues` (which is already in the public game state). It
  never touches `game.players[i]` for any `i`.
- `SimPanel` passes `playerSim` straight through to `RelationshipPanel` —
  no iteration of `game.players` for opponents' relationships.
- The server-side `contactedByPlayer` Map is function-local to
  `advanceFromSimDay` and never reaches `broadcastStateSecure` or
  `derivePublicState`. Each connection's `YOUR_SIM_STATE` message carries
  only its own relationships (mirrors the Phase 3 YOUR_HAND pattern).

## Known Stubs

**Bid likelihood modifier → auction layer adapter**
- `deriveBidLikelihoodModifiers` is exported and unit-tested, but the
  auction engine (`applySimModifiers` and the bid ceiling path) does not
  yet consume its output. Wiring it into the auction loop is a discrete
  follow-up in a later Phase 4 plan (or late Phase 4 integration plan).
  The plan's DEPTH-03 acceptance says the modifier is "returned by
  `applySimModifiers` and consumed by the auction layer" — the derivation
  side is done; the consumption side is pending.

This is a deliberate scope cut for Plan 04-01 (the plan's <behavior> block
defines the function signature but does NOT wire it into applySimModifiers).

## Commits

- `e555df1` — feat(04-01): add relationship type layer + pure engine functions
- `95d4aee` — feat(04-01): wire dropped-artist seed + RelationshipPanel UI

## Self-Check: PASSED

Files exist:
- FOUND: src/types/game.ts (extended)
- FOUND: src/lib/sim-config.ts (extended)
- FOUND: src/lib/sim-engine.ts (extended)
- FOUND: src/lib/sim-engine.test.ts (extended)
- FOUND: src/components/sim/RelationshipPanel.tsx
- FOUND: src/components/sim/RelationshipPanel.test.tsx
- FOUND: src/components/sim/SimPanel.tsx (modified)
- FOUND: src/components/sim/SimPanel.test.tsx (modified)
- FOUND: party/server.ts (modified)

Commits exist:
- FOUND: e555df1 (Task 1: types + config + engine + tests)
- FOUND: 95d4aee (Task 2: server seed + RelationshipPanel)

Tests pass:
- FOUND: 156/156 vitest green
- FOUND: tsc --noEmit exit 0

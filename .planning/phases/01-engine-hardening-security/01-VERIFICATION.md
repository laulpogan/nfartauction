---
phase: 01-engine-hardening-security
verified: 2026-04-06T21:08:00Z
status: passed
score: 5/5 success criteria verified; 10/10 ENG requirements satisfied
overrides_applied: 0
---

# Phase 1: Engine Hardening & Security Verification Report

**Phase Goal:** The auction engine is trustworthy, tested, and clean — no security bugs, no dead code, no logic duplication
**Verified:** 2026-04-06T21:08:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Player cannot read other players' sealed bid amounts from WebSocket frame before reveal | VERIFIED | `derivePublicState` (party/server.ts:110-121) unconditionally maps `auction.sealedBids` to `Record<number, true>` (presence-only). Applied in both `onConnect` (line 137), JOIN reconnect branch (line 200), and per-connection `broadcastStateSecure` (line 472-479). The raw amounts in `auction.sealedBids: Record<number, number>` never leave the server. |
| 2 | Player cannot see remaining deck by inspecting broadcast GameState | VERIFIED | `derivePublicState` (party/server.ts:111, 120) destructures out `deck` and replaces it with `[] as never[]` in the projected `PublicGameState`. Type system enforces this via `PublicGameState.deck: never[]` (src/types/game.ts:75-78). |
| 3 | Non-auctioneer second-card attempt rejected by server (faithful Knizia waitingSecondCardIdx enforcement) | VERIFIED | `PLAY_SECOND_CARD` handler (party/server.ts:301-309) hard-checks `auction.status === 'waiting_second' && auction.waitingSecondCardIdx === session.position` before invoking engine; rejects with ERROR otherwise. `PASS_SECOND_CARD` handler (lines 328-345) applies the same guard. Engine `passSecondCard` (engine.ts:180-211) advances clockwise; on full wrap back to `auctioneerIdx`, returns `auctioneerTakesFree: true` and clears the auction. Tests cover the full pass cycle and the guard. |
| 4 | Malformed WebSocket messages rejected before reaching engine functions (Zod gate) | VERIFIED | `InboundMessage` Zod discriminatedUnion schema (party/server.ts:26-39) covers all 12 message types. `onMessage` (lines 147-162) does `JSON.parse` → `InboundMessage.safeParse`; on parse failure sends `{type:'ERROR',message:'Invalid message'}` and aborts. `handleMessage` typed as `InboundMessage` so no `as Card`/`as number` casts remain. Validation: name 1-30 printable ASCII; PLACE_OPEN_BID amount int min(1); SUBMIT_SEALED_BID amount int min(0); CardSchema enforces artist/auctionType enum membership. |
| 5 | Engine test suite runs green covering all 5 auction types, cumulative valuation, round-end trigger, sealed-bid tie-breaking | VERIFIED | `npx vitest run` → **Test Files 2 passed (2), Tests 36 passed (36)**, duration 258ms. Coverage in src/lib/engine.test.ts: round-end trigger (2 tests), open auction (4), once_around (3), sealed_bid + tie-breaking (4), fixed_price (4), double + pass cycle (5), cumulative valuation across 2 rounds (3), startGame (1). deck.test.ts adds buildDeck/dealHands/shuffle. |

**Score:** 5/5 success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/game.ts` | waitingSecondCardIdx, PublicGameState, PublicAuctionState; PlayerRecord without gameId | VERIFIED | Line 42: `waitingSecondCardIdx: number`. Lines 71-78: PublicAuctionState (sealedBids: Record<number,true>) and PublicGameState (deck: never[]). PlayerRecord (lines 80-89): no gameId field. |
| `src/lib/engine.ts` | playSecondCard reassigns auctioneer; passSecondCard new export; sealed-bid tie-break `>=` rule | VERIFIED | Line 151: `newAuctioneerIdx = player.position` sets new auctioneer in playSecondCard. Lines 180-211: passSecondCard exported, clockwise wrap detection. Line 357: `if (auctBid >= maxBid && maxBid > 0)` — auctioneer wins ties. |
| `party/server.ts` | derivePublicState; broadcastStateSecure; PASS_SECOND_CARD handler; reconnect lastRoundResult; Zod gate; startGame delegation; no msg.isHost; no inline deal logic | VERIFIED | derivePublicState (110), broadcastStateSecure (472), PASS_SECOND_CARD handler (328), lastRoundResult in onConnect (142) and PLAY_CARD round-end (283), Zod safeParse (151), engine.startGame call (240), no `msg.isHost` reads, no inline `shuffle(buildDeck())`. |
| `src/lib/engine.test.ts` | All required test coverage, ≥200 lines | VERIFIED | 379 lines, 36 passing tests, 0 skipped/todo. |
| `src/lib/deck.test.ts` | buildDeck/dealHands/shuffle tests | VERIFIED | Exists; covered in test run (part of 36/36 green). |
| `vite.config.ts` | test block with environment node and src glob | VERIFIED | `npx vitest run` discovers files and runs successfully. |

### Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| broadcastStateSecure | derivePublicState | per-connection send loop | WIRED (line 474) |
| PLAY_SECOND_CARD handler | auction.waitingSecondCardIdx | index comparison before engine call | WIRED (line 306) |
| PASS_SECOND_CARD handler | engine.passSecondCard | direct call after guard | WIRED (line 337) |
| onConnect | state.lastRoundResult | conditional ROUND_END send | WIRED (line 142-144) |
| onMessage | InboundMessage.safeParse | parse result check before handleMessage | WIRED (line 151-155) |
| START_GAME handler | engine.startGame | direct import call, no inline deal logic | WIRED (line 240) |
| engine.test.ts | engine.ts exports | direct import | WIRED (line 2-6) |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| ENG-01 | Sealed bids hidden until reveal | SATISFIED | derivePublicState strips bid amounts unconditionally (party/server.ts:110-121) |
| ENG-02 | Deck excluded from public broadcast | SATISFIED | derivePublicState forces `deck: []` (party/server.ts:120); type system enforces |
| ENG-03 | Only auctioneer logic — faithful Knizia: only the player at waitingSecondCardIdx may play/pass second card | SATISFIED | Server guards lines 306, 333; engine clockwise advance + wrap (engine.ts:180-211); test: full clockwise wrap returns `auctioneerTakesFree: true` |
| ENG-04 | Host assigned server-side by connection order | SATISFIED | First-connect branch sets `isHost: true` (line 176); subsequent joins always `isHost: false` (line 217); `msg.isHost` never read |
| ENG-05 | All inbound messages Zod-validated | SATISFIED | InboundMessage discriminatedUnion + safeParse gate in onMessage |
| ENG-06 | startGame logic in engine only | SATISFIED | START_GAME handler delegates to `engine.startGame()` (line 240); no `shuffle(buildDeck())` in server |
| ENG-07 | Dead Supabase/SQL/zustand removed | SATISFIED | `supabase.ts`, `supabase_migration.sql` deleted; grep for "supabase" in src/ and party/ returns 0; package.json contains no @supabase/supabase-js or zustand |
| ENG-08 | Round-end trigger fires when 5th painting played (pre-auction) | SATISFIED | engine.ts:77-87 returns `roundEnded: true, auction: null` when count reaches 5; test "round-end trigger" passes (2 tests) |
| ENG-09 | Reconnecting player receives last round summary | SATISFIED | `lastRoundResult` persisted (line 283); replayed in onConnect (line 142) and JOIN reconnect branch (line 202) |
| ENG-10 | Engine unit tests covering all 5 auction types, cumulative valuation, round-end, sealed-bid tie-breaking | SATISFIED | 36 tests pass; coverage matches the requirement explicitly |

All 10 ENG requirements satisfied. No orphaned requirements.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Engine test suite green | `npx vitest run` | Test Files 2 passed (2), Tests 36 passed (36), Duration 258ms | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | Exit 0, no output | PASS |
| Dead Supabase files removed | `ls supabase_migration.sql src/lib/supabase.ts` | both ENOENT | PASS |
| No supabase refs in source | `grep -r supabase src/ party/` | 0 matches | PASS |
| Dead deps removed from package.json | grep `@supabase\|zustand` | 0 matches; zod ^4.3.6 + vitest ^4.1.2 present | PASS |

### Anti-Patterns Found

None. No TODO/FIXME/PLACEHOLDER comments in modified files. No empty stub returns. Sealed bid `>= && > 0` rule correctly handles the all-zero edge case via the dedicated `maxBid === 0` branch in submitSealedBid.

### Human Verification Required

None. All Phase 1 success criteria are verifiable by automated test, type-check, and code inspection. The Phase 1 work is engine and server logic with no UI surface, no real-time multi-client coordination, and no external services to integrate.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria pass goal-backward verification, all 10 ENG-* requirements are satisfied with concrete code evidence, the test suite runs 36/36 green in 258ms, TypeScript compiles cleanly, and all dead code/dependencies were verified removed.

---

_Verified: 2026-04-06T21:08:00Z_
_Verifier: Claude (gsd-verifier)_

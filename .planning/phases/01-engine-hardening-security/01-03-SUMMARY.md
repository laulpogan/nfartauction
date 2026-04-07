---
phase: 01-engine-hardening-security
plan: 03
subsystem: engine, test-infra
tags: [testing, vitest, tdd, engine, knizia-rules]
requires:
  - 01-01
  - 01-02
provides:
  - vitest test runner (configured)
  - engine.test.ts (36 tests)
  - deck.test.ts
  - regression suite for all five auction types
  - ENG-08 round-end trigger lock
  - ENG-10 engine invariants locked (tie-break, cumulative valuation, pass-cycle)
affects:
  - vite.config.ts
  - src/lib/engine.test.ts
  - src/lib/deck.test.ts
tech-stack:
  added: []
  patterns:
    - Vitest 4 co-located unit tests
    - pure-function engine testing (no mocks, no fixtures on disk)
    - helper factories for GameState and PlayerRecord
key-files:
  created:
    - src/lib/engine.test.ts
    - src/lib/deck.test.ts
  modified:
    - vite.config.ts
decisions:
  - "No shared testHelpers.ts file — helpers are co-located at the top of engine.test.ts. They are not reused across deck.test.ts (which has its own, simpler helpers), so extracting would add an import with zero deduplication benefit."
  - "Sealed-bid self-buy behavior verified: when the auctioneer wins via the tie-break, the engine's resolveAuction branch deducts money from the auctioneer but does not add it back (isSelfBuy=true → 'pays bank'). Test locks this as expected behavior."
  - "Used it('...') throughout — no it.todo, no it.skip. Every test has real assertions."
metrics:
  duration: ~10min
  completed: 2026-04-07
  tests_passing: 36
  test_files: 2
---

# Phase 1 Plan 03: Engine Test Suite Summary

Added the Vitest 4 test infrastructure and a complete regression suite for the Modern Art engine — 36 tests across engine.test.ts and deck.test.ts, all green, running in ~200ms. Every auction type, the round-end trigger (ENG-08), the sealed-bid auctioneer tie-break (ENG-10), cumulative valuation compounding across rounds, and the double-auction PASS_SECOND_CARD full-wrap cycle are now machine-verified.

## Files Modified

### vite.config.ts
- Added `/// <reference types="vitest/config" />` triple-slash directive
- Added `test` block with `environment: 'node'` and `include: ['src/**/*.test.ts']`
- Preserved existing `plugins: [react(), tailwindcss()]`

### src/lib/deck.test.ts (new)
- `buildDeck`: 70-card total, exact per-artist distribution (lite_metal=12, yoko=13, christine_p=14, karl_gitter=15, krypto=16), unique ids
- `dealHands`: round-1 3-player = 10/hand with 40 remaining; round-2 4-player = 4/hand; no card appears in two hands; remaining deck is disjoint from dealt cards
- `shuffle`: same length, same set, does not mutate the original array

### src/lib/engine.test.ts (new)
36 tests across 9 describe blocks. Test helpers (`makeTestPlayer`, `card`, `makeGame`, `beginAuction`) are co-located at the top of the file.

**Round-end trigger (ENG-08):**
- 5th painting of an artist → `roundEnded: true`, `auction: null`, `artistCounts[artist] === 5`
- 4th painting → `roundEnded: false`, auction created

**Open auction (4 tests):**
- `placeOpenBid` records amount and leading bidder
- Rejects bids at or below current bid
- `endOpenAuction` resolves money transfer (buyer pays, auctioneer receives)
- Free painting to auctioneer when no bids placed

**Once-around auction (3 tests):**
- Non-auctioneer bids advance turn without `updatedPlayers`
- Auctioneer bids last → resolution; highest bidder wins and pays
- All pass → auctioneer gets painting free

**Sealed bid — tie-breaking (ENG-10, 4 tests):**
- Auctioneer wins a 3-way tie at 5000 (locks the `auctBid >= maxBid && maxBid > 0` rule fixed in Plan 01-02). Self-buy deducts 5000 from the auctioneer but does not return it — this is the existing resolveAuction "pays bank" branch for self-buys.
- Leftmost non-auctioneer wins a tie between non-auctioneers (player 1 beats player 2 when both bid 5000 and auctioneer bids 1000)
- Everyone bids 0 → auctioneer gets painting free
- Partial submission does not resolve

**Fixed price auction (4 tests):**
- `setFixedPrice` records price and flips status to `'active'`
- `acceptFixedPrice` (non-self) transfers price from buyer to auctioneer
- `acceptFixedPrice` (self-buy) deducts from auctioneer, no receive
- `passFixedPrice` advances `onceAroundCurrentIdx` clockwise

**Double auction — second card mechanics (5 tests):**
- `playCard` on a double card → `status: 'waiting_second'`, `waitingSecondCardIdx` = clockwise of auctioneer
- `passSecondCard` advances `waitingSecondCardIdx` clockwise
- Full clockwise wrap (3-player game, auctioneer at 0, passes 0→1→2→back to 0) → `auctioneerTakesFree: true`, `auction: null`
- `playSecondCard` reassigns `auctioneerIdx` to the player of the 2nd card (faithful Knizia rule from Plan 01-01)
- `passSecondCard` throws when auction is not in `waiting_second`

**Cumulative valuation (ENG-10, 3 tests):**
- Round 1: top artist gets 30000, cumulativeValue = 30000, owner paid 30000
- Round 2: same top artist compounds, cumulativeValue = 60000, owner paid 60000
- Player with 2 paintings of top artist gets 2 × cumulative value (120000)

**startGame (1 test):**
- Status flips to `'playing'`, hands populated, money reset to 100000, paintings cleared, deck reduced to 40 cards (70 − 3×10).

## Requirements Closed

| Req | Mechanism |
|-----|-----------|
| ENG-08 | Two round-end trigger tests lock the current (correct) behavior: 5th painting returns `roundEnded: true` with `auction: null`; 4th painting creates an auction. Any future regression fails CI. |
| ENG-10 | Full auction-type coverage (open, once_around, sealed_bid, fixed_price, double) + auctioneer tie-break + cumulative valuation test compounding across two rounds + PASS_SECOND_CARD full-wrap cycle. All green, all non-skipped. |

## Threat Model — Mitigations Applied

| Threat ID | Status |
|-----------|--------|
| T-1-12 (engine correctness regressions) | mitigated — 36 tests lock all invariants; `npx vitest run` must pass before merge |
| T-1-13 (undocumented rule interpretations) | mitigated — every Knizia rule has a named test with explanatory comment |
| T-1-14 (test-file secret exposure) | accepted — test files import only from ./engine and ./deck, both pure modules |

## Deviations from Plan

None. Plan 01-03 executed exactly as written. Both Task 1 (config + stubs) and Task 2 (full implementation) passed on first run. No engine bugs were uncovered during testing — Plans 01-01 and 01-02 had already landed the fixes.

## Acceptance Criteria — Verification

| Criterion | Result |
|-----------|--------|
| `test:` block in vite.config.ts with `environment` and `include` | line 7-10 |
| `/// <reference types="vitest/config" />` in vite.config.ts | line 1 |
| `src/lib/engine.test.ts` exists | yes |
| `src/lib/deck.test.ts` exists | yes |
| `from './engine'` in engine.test.ts | line 3 |
| `npx vitest run` exit code | 0 |
| Tests passing | 36 of 36 |
| Tests skipped / todo / pending | 0 |
| `npx tsc --noEmit` | exits 0, no output |
| round-end trigger test present | 2 tests, both green |
| sealed-bid tie-break test present | 4 tests, all green |
| double auction test present | 5 tests, all green |
| cumulative valuation test present | 3 tests, all green |
| all 5 auction types covered | open (4) / once_around (3) / sealed_bid (4) / fixed_price (4) / double (5) |

## Vitest Final Output

```
 Test Files  2 passed (2)
      Tests  36 passed (36)
   Duration  185ms (transform 66ms, setup 0ms, import 91ms, tests 11ms, environment 0ms)
```

## Commits

- `f5f7934` — test(01-03): add Vitest config and stub test files
- `b71d039` — test(01-03): implement full engine and deck test suite

## Known Stubs

None. All tests have real assertions.

## Self-Check: PASSED

- vite.config.ts: FOUND (with test block)
- src/lib/engine.test.ts: FOUND
- src/lib/deck.test.ts: FOUND
- Commit f5f7934: FOUND
- Commit b71d039: FOUND
- `npx vitest run`: 36 passed, 0 failed, 0 skipped
- `npx tsc --noEmit`: exit 0
- All acceptance criteria: pass

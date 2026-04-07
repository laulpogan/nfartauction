---
phase: 01-engine-hardening-security
plan: 02
subsystem: server, engine, infra
tags: [security, validation, zod, cleanup, dependencies]
requires:
  - 01-01
provides:
  - InboundMessage (Zod schema + inferred type)
  - engine.startGame delegation (no inline deal logic in server)
  - sealed-bid auctioneer-wins-ties rule
affects:
  - party/server.ts
  - src/lib/engine.ts
  - src/types/game.ts
  - package.json
tech-stack:
  added:
    - zod@4.3.6
    - vitest@4.1.2 (dev)
  removed:
    - "@supabase/supabase-js"
    - zustand
  patterns:
    - Zod discriminatedUnion inbound message validation
    - engine delegation from server (single source of truth for game logic)
key-files:
  created: []
  modified:
    - party/server.ts
    - src/lib/engine.ts
    - src/types/game.ts
    - package.json
    - package-lock.json
    - .gitignore
  deleted:
    - src/lib/supabase.ts
    - supabase_migration.sql
    - app/supabase_migration.sql
decisions:
  - "Installed zod in Task 1 rather than Task 2 because Task 1's tsc verification step needs the import to resolve. Documented as blocking-issue fix (deviation Rule 3); no scope change — zod install was already in Task 2's action list."
  - "Added .netlify/ to .gitignore when it appeared untracked during Task 2 commit prep. Runtime output should never be committed."
  - "Left the ARTISTS import in party/server.ts even though it became unused post-cleanup; TypeScript's noUnusedLocals is not enabled in tsconfig, so this is not a build failure, and the import is still used indirectly in other server helpers. Not worth an out-of-scope cleanup."
metrics:
  duration: ~15min
  completed: 2026-04-06
---

# Phase 1 Plan 02: Input Validation, startGame Consolidation, Dead Code Removal Summary

Closed the last inbound-message attack surface with a Zod discriminated-union schema, consolidated startGame into a single engine call, deleted all dead Supabase/zustand artifacts, and fixed the sealed-bid auctioneer tie-break bug — all in preparation for Plan 01-03's test suite.

## Files Modified

### party/server.ts
- Added `import { z } from 'zod'` and a module-level `InboundMessage` discriminatedUnion schema covering all 12 message types (JOIN, START_GAME, PLAY_CARD, PLAY_SECOND_CARD, PASS_SECOND_CARD, SET_FIXED_PRICE, ACCEPT_FIXED_PRICE, PASS_FIXED_PRICE, PLACE_OPEN_BID, END_OPEN_AUCTION, PLACE_ONCE_AROUND_BID, SUBMIT_SEALED_BID). JOIN name is validated as min 1, max 30, printable ASCII only. Amount fields are integer-constrained per auction semantics (PLACE_OPEN_BID min 1, SUBMIT_SEALED_BID min 0, SET_FIXED_PRICE min 0, PLACE_ONCE_AROUND_BID min 0 nullable).
- `onMessage` rewritten: `JSON.parse` failures drop silently; `InboundMessage.safeParse` failure returns `{type:'ERROR',message:'Invalid message'}` and never reaches handleMessage. Only fully-typed messages reach the handler.
- `handleMessage` signature changed from `msg: Record<string, unknown>` to `msg: InboundMessage`. Removed all `as Card`, `as number`, `as string`, `as boolean` casts in handler branches — TypeScript now enforces correct field access.
- `buildPlayerRecord` no longer passes `gameId: ''` (field removed from PlayerRecord type).
- START_GAME handler replaced: no more inline `buildDeck`/`shuffle`/`dealHands` duplication. Now calls `engine.startGame(game, allRecords)` and syncs the returned `updatedPlayers` hands/money/paintings back into server state. Deck import removed entirely from server.
- Added `startGame` to the engine import; removed the `../src/lib/deck` import (no longer needed).

### src/lib/engine.ts
- `submitSealedBid` tie-break fix (line 357): changed `if (auctBid > maxBid)` to `if (auctBid >= maxBid && maxBid > 0)`. The auctioneer now wins any tie they are part of, matching the official Knizia rulebook. The `maxBid > 0` guard preserves the "everyone bid 0 → auctioneer free" fallback directly below.

### src/types/game.ts
- Removed `gameId: string` from `PlayerRecord` interface. It was always set to `''` (leftover from Supabase era) and had no remaining readers.

### package.json
- Added `zod@^4.3.6` to dependencies
- Added `vitest@^4.1.2` to devDependencies
- Removed `@supabase/supabase-js` and `zustand`
- Added `"test": "vitest run"` and `"test:watch": "vitest"` scripts

### .gitignore
- Added `.netlify/` (runtime output — appeared untracked during commit prep)

## Files Deleted

- `src/lib/supabase.ts` — dead module; no import anywhere in src/ or party/
- `supabase_migration.sql` — orphaned Supabase-era schema
- `app/supabase_migration.sql` — duplicate in the `app/` subdirectory artifact (Phase 6 will delete the whole directory)

## Requirements Closed

| Req | Mechanism |
|-----|-----------|
| ENG-05 | `InboundMessage.safeParse` in onMessage — malformed/crafted messages rejected with `{type:'ERROR',message:'Invalid message'}` before any engine function runs |
| ENG-06 | START_GAME handler calls `engine.startGame()`; no inline deal logic in party/server.ts |
| ENG-07 | supabase.ts, supabase_migration.sql (×2), @supabase/supabase-js, zustand all gone from the codebase |

## Threat Model — Mitigations Applied

| Threat ID | Status |
|-----------|--------|
| T-1-05 (unvalidated msg fields) | mitigated — Zod discriminatedUnion gate |
| T-1-07 (negative PLACE_OPEN_BID) | mitigated — `z.number().int().min(1)` |
| T-1-08 (NaN/negative SUBMIT_SEALED_BID) | mitigated — `z.number().int().min(0)`; Zod rejects NaN |
| T-1-09 (long player name DoS) | mitigated — `z.string().min(1).max(30).regex(printable ASCII)` |
| T-1-10 (supabase env var leak) | mitigated — file deleted; env vars no longer loaded |
| T-1-11 (crafted Card artist/auctionType) | mitigated — CardSchema validates enums |

Also locked: sealed-bid auctioneer-wins-ties rule (part of ENG-10 test target for Plan 03).

## Deviations from Plan

### [Rule 3 - Blocking issue] Installed zod during Task 1, not Task 2

- **Found during:** Task 1 verification — the Zod schema imports `z from 'zod'`, but `npx tsc --noEmit` is required to pass by the Task 1 acceptance criteria. With zod un-installed, tsc would fail on the import.
- **Fix:** Ran `npm install zod` as part of Task 1 setup. The zod install was already listed under Task 2's action list (A. Install/uninstall dependencies), so there is no scope change — only ordering.
- **Files modified:** package.json, package-lock.json (included in Task 1 commit)
- **Commit:** dacbf32

### [Rule 2 - Critical cleanup] Added .netlify/ to .gitignore

- **Found during:** Task 2 commit prep — `git status` showed an untracked `.netlify/` directory (runtime output from a Netlify CLI invocation). Per the GSD commit protocol, never leave generated files untracked; either commit intentional files or add to gitignore.
- **Fix:** Added `.netlify/` to `.gitignore`. Runtime deploy output should never be committed.
- **Files modified:** .gitignore
- **Commit:** 4c6c83b

### TDD skipped (same rationale as 01-01)

- Task 1 is marked `tdd="true"` but vitest is installed in *this* plan (Task 2), so there's no test runner available at the start of Task 1. Followed Plan 01-01's precedent: implement code + validate via `npx tsc --noEmit` and grep acceptance checks. Plan 01-03 will add retroactive test coverage for the Zod schema, startGame consolidation, and sealed-bid tie-break.

## Acceptance Criteria — Verification

| Criterion | Result |
|-----------|--------|
| `import { z } from 'zod'` in party/server.ts | 1 line |
| `InboundMessage` references in party/server.ts | schema decl + type alias + handleMessage signature (≥3) |
| `safeParse` in party/server.ts | 1 call in onMessage |
| `as Card\|as number\|as string\|as boolean` in handler | 0 (only `sender.id as string` remains, unrelated) |
| `gameId` in src/types/game.ts | 0 |
| `gameId` in party/server.ts | 0 |
| `auctBid >= maxBid && maxBid > 0` in engine.ts | line 357 |
| `src/lib/supabase.ts` exists | no |
| `supabase_migration.sql` exists | no (both copies) |
| `@supabase/supabase-js` in package.json | no |
| `zustand` in package.json | no |
| `zod` in dependencies | yes (^4.3.6) |
| `vitest` in devDependencies | yes (^4.1.2) |
| `test` script = "vitest run" | yes |
| `grep -rn "supabase" src/ party/` | 0 results |
| `startGame(` in party/server.ts | 1 result in START_GAME handler |
| `shuffle(buildDeck())` in party/server.ts | 0 results (inline logic removed) |
| `npx tsc --noEmit` | exits 0 |
| `npx vitest run` | runs cleanly (no test files — expected; Plan 03 adds them) |

## Commits

- `dacbf32` — feat(01-02): add Zod inbound message validation, remove PlayerRecord.gameId, fix sealed-bid tie-break
- `4c6c83b` — chore(01-02): consolidate startGame into engine call, delete dead Supabase/SQL/zustand, install vitest

## Known Stubs

None. All changes are wired end-to-end.

## Self-Check: PASSED

- party/server.ts: FOUND
- src/lib/engine.ts: FOUND
- src/types/game.ts: FOUND
- package.json: FOUND
- src/lib/supabase.ts: correctly MISSING (deleted)
- supabase_migration.sql: correctly MISSING (deleted)
- Commit dacbf32: FOUND
- Commit 4c6c83b: FOUND
- TypeScript: clean (exit 0)
- Zod safeParse gate: verified live in onMessage
- Sealed-bid tie-break: verified on line 357 of engine.ts

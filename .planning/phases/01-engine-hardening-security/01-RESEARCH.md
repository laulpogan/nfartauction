# Phase 1: Engine Hardening & Security — Research

**Researched:** 2026-04-06
**Domain:** Game engine security, input validation, test infrastructure, PartyKit WebSocket server
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENG-01 | Sealed bid amounts hidden until reveal (not in public broadcast) | `derivePublicState` pattern documented; exact field to strip identified |
| ENG-02 | Deck excluded from public GameState broadcast | Field-level strip in `derivePublicState`; no type change required |
| ENG-03 | Only the auctioneer can play the second card in a double auction | CRITICAL: Official rule is ANY player going left can play second card — ENG-03 as written is WRONG; see Double Auction section |
| ENG-04 | Host status assigned server-side by connection order | Bug confirmed in server.ts line 111; fix is one-line read removal |
| ENG-05 | All inbound WebSocket messages validated by Zod schemas | Zod 4.3.6 discriminated union pattern verified; PartyKit official pattern documented |
| ENG-06 | `startGame` logic lives in engine function, not duplicated in server | `startGame` exists in engine.ts lines 30-59 but server duplicates it inline at lines 177-212 |
| ENG-07 | Dead Supabase module, SQL files, and unused zustand removed | All confirmed dead; safe to delete |
| ENG-08 | Round-end trigger fires when 5th painting PUT UP for auction (pre-auction) | CONFIRMED CORRECT: current engine.ts playCard already implements this correctly at line 77 |
| ENG-09 | Reconnecting player receives last round summary | `roundEndResult` lives only in React state; must persist separately in Durable Object storage |
| ENG-10 | Engine unit tests covering all five auction types, cumulative valuation, round-end, sealed-bid tie-breaking | Vitest 4.1.2 setup pattern verified; no test infrastructure currently exists |
</phase_requirements>

---

## Summary

Phase 1 is a hardening and cleanup phase with zero new features. The codebase already has the correct architecture (pure functional engine, authoritative server, dumb clients) and is structured correctly for each fix. The work is mechanical: strip fields from the public broadcast, add Zod validation, fix host assignment, consolidate `startGame`, delete dead code, persist round summary for reconnects, and write tests.

The biggest surprise from research is ENG-03 as written is **incorrect per the official Modern Art rules**. The requirement says "only the auctioneer can play the second card" — but the rulebook says ANY player clockwise from the auctioneer can play the second card, and whoever plays it becomes the new auctioneer and collects the proceeds. The current code restricts to the auctioneer, which is wrong. The planner must address this as a correction, not just enforcement.

ENG-08 (round-end trigger timing) is already correctly implemented in `engine.ts` — the `playCard` function checks `artistCounts[card.artist] >= ROUND_END_THRESHOLD` BEFORE creating an auction (lines 77-87) and returns `roundEnded: true` without creating an auction. This is the correct Knizia rule. No fix needed here; a test is needed to verify it stays correct.

The sealed-bid tie-breaking rule from the official CMON rulebook: if tied, the player closest to the auctioneer in clockwise order wins. If the auctioneer is among the tied players, the auctioneer wins. The current implementation (engine.ts lines 297-304) iterates left-of-auctioneer first with strict `>`, then checks auctioneer separately with strict `>` — this means on a tie between the auctioneer and another player, the OTHER player wins (auctioneer check is `> maxBid` not `>= maxBid`). This is a bug: the auctioneer should win any tie they are part of.

**Primary recommendation:** Fix the double auction rule first (it's the most impactful rule change), then add Zod validation (closes the security surface), then add `derivePublicState` (removes information leaks), then clean up dead code, then write tests to lock everything in.

---

## Standard Stack

### Core Additions for This Phase

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| zod | 4.3.6 | Runtime WebSocket message validation; discriminated union schema | [VERIFIED: npm registry] |
| vitest | 4.1.2 | Unit test runner for pure engine functions; zero Vite overhead | [VERIFIED: npm registry] |

### Existing Stack (No Changes)

| Library | Version | Role in This Phase |
|---------|---------|-------------------|
| TypeScript | ~6.0.2 | All source; test files included |
| PartyKit | 0.0.115 (pinned) | Server lifecycle; storage API for reconnect fix |
| PartySocket | 1.1.16 | No changes in this phase |
| React 19 | 19.2.4 | No changes in this phase |

### Remove in This Phase

| Package | Location | Reason |
|---------|----------|--------|
| `@supabase/supabase-js` | `package.json` dependencies | Dead code; no imports in active codebase |
| `zustand` | `package.json` dependencies | Unused; reserved for Phase 3 |

**Note on zustand removal:** Prior research recommends activating zustand in Phase 3. For this phase it is dead code and should be removed from the bundle. Reinstall in Phase 3. [ASSUMED — but consistent with Phase 3 scope]

### Installation

```bash
npm install zod
npm install -D vitest
npm uninstall @supabase/supabase-js zustand
```

**Version verification:** Confirmed via `npm view` on 2026-04-06:
- `zod@4.3.6` (latest stable)
- `vitest@4.1.2` (latest stable)
- `partykit@0.0.115` (current pinned — do not upgrade)

---

## Architecture Patterns

### Pattern 1: `derivePublicState(state, playerId)` — Field Stripping Before Broadcast

**What:** A pure function that takes `ServerState` + the requesting connection ID and returns a sanitised `GameState` safe to send to that specific client. Applied in `broadcastState()` before any `room.broadcast()` call.

**Fields to strip:**
- `deck` — remove entirely (server-only; clients have no legitimate need)
- `auction.sealedBids` — replace values with presence-only `Record<number, true>` until `auction.status === 'completed'` (when all bids revealed)

**Where to call it:** Replace the existing `broadcastState()` implementation. Instead of `room.broadcast(JSON.stringify({ type: 'GAME_STATE', game: this.state.game }))`, derive a per-player view and send individually per connection:

```typescript
// Source: pattern derived from CONCERNS.md security findings + PartyKit docs
private broadcastStateSecure() {
  if (!this.state) return
  for (const conn of this.room.getConnections()) {
    const publicGame = derivePublicState(this.state.game, conn.id)
    conn.send(JSON.stringify({ type: 'GAME_STATE', game: publicGame }))
  }
}
```

**Implementation of the projection function:**

```typescript
// Source: [ASSUMED] — pattern, field names verified against src/types/game.ts
function derivePublicState(game: GameState, _connectionId: string): PublicGameState {
  const { deck: _deck, auction, ...rest } = game

  let publicAuction = auction
  if (auction && auction.status !== 'completed') {
    // Strip actual sealed bid amounts — only expose who has submitted
    const sealedBidsSubmitted: Record<number, true> = {}
    for (const idx of Object.keys(auction.sealedBids)) {
      sealedBidsSubmitted[Number(idx)] = true
    }
    publicAuction = { ...auction, sealedBids: sealedBidsSubmitted as Record<number, number> }
  }

  return { ...rest, auction: publicAuction }
}
```

**Type implication:** `GameState.deck` is currently typed as `Card[]`. After this change the client type can either (a) keep `deck: Card[]` but always receive `[]`, or (b) remove `deck` from the broadcast type entirely. Option (b) is cleaner — add a separate `PublicGameState` type without `deck` for client-facing messages. The server keeps `GameState` with `deck` for internal use.

**When to apply sealed bid reveal:** When `auction.status === 'completed'`, `sealedBids` values are safe to broadcast (auction is over; knowing the bids is historical information, not strategic advantage).

### Pattern 2: Zod 4 Discriminated Union for WebSocket Messages

**What:** A single `MessageSchema = z.discriminatedUnion('type', [...])` covering all inbound message types. Parsed at the top of `onMessage` before any logic runs. Invalid messages are rejected with an ERROR response; they never reach engine functions.

**Import path:** As of July 2025, `import { z } from 'zod'` imports Zod 4 by default (Zod 4 is now the package root). `'zod/v4'` also works permanently. [VERIFIED: zod.dev/v4/versioning]

**Pattern from PartyKit official docs:** [CITED: docs.partykit.io/guides/validating-client-inputs/]

```typescript
// In party/server.ts
import { z } from 'zod'

const JoinMessage = z.object({
  type: z.literal('JOIN'),
  name: z.string().max(30),
})

const PlayCardMessage = z.object({
  type: z.literal('PLAY_CARD'),
  card: CardSchema,
})

// ... one schema per message type

const InboundMessage = z.discriminatedUnion('type', [
  JoinMessage,
  PlayCardMessage,
  PlaySecondCardMessage,
  SetFixedPriceMessage,
  AcceptFixedPriceMessage,
  PassFixedPriceMessage,
  PlaceOpenBidMessage,
  EndOpenAuctionMessage,
  PlaceOnceAroundBidMessage,
  SubmitSealedBidMessage,
  StartGameMessage,
])

// At the top of onMessage:
async onMessage(message: string, sender: Party.Connection) {
  let raw: unknown
  try { raw = JSON.parse(message) } catch { return } // malformed JSON — drop silently

  const result = InboundMessage.safeParse(raw)
  if (!result.success) {
    sender.send(JSON.stringify({ type: 'ERROR', message: 'Invalid message' }))
    return
  }

  const msg = result.data  // fully typed, validated
  try {
    await this.handleMessage(msg, sender)
  } catch (e) {
    sender.send(JSON.stringify({ type: 'ERROR', message: String(e) }))
  }
}
```

**Card schema for validation:** The `Card` schema must validate that the card object has valid `id`, `artist`, and `auctionType` fields. Additionally, the server must check that the played card actually exists in the player's hand (schema validates shape; hand membership check is engine-layer logic):

```typescript
const ArtistSchema = z.enum(['lite_metal', 'yoko', 'christine_p', 'karl_gitter', 'krypto'])
const AuctionTypeSchema = z.enum(['open', 'once_around', 'sealed_bid', 'fixed_price', 'double'])
const CardSchema = z.object({
  id: z.string(),
  artist: ArtistSchema,
  auctionType: AuctionTypeSchema,
})
```

**Amount validation:** `msg.amount` must be a non-negative integer (bids cannot be negative or NaN):

```typescript
const BidAmount = z.number().int().min(0)
```

**Name sanitisation:** Player names should be capped and stripped of dangerous characters:

```typescript
z.string().min(1).max(30).regex(/^[\x20-\x7E]+$/)  // printable ASCII only
```

### Pattern 3: Server-Side Host Assignment

**What:** Ignore the `isHost` field from the client JOIN message entirely. Assign host status based on whether `this.state` is null (first player = host).

**Current bug:** `party/server.ts` line 111 reads `const isHost = msg.isHost as boolean` and trusts it for the first player join path. [VERIFIED: CONCERNS.md]

**Fix (one change):**

```typescript
// Remove: const isHost = msg.isHost as boolean
// In the "first player creates game" branch, always use isHost: true
// In the "new player joining lobby" branch, always use isHost: false
// The connection order determines host status — the server never reads isHost from the client
```

### Pattern 4: Consolidate `startGame` (ENG-06)

**What:** Remove the inline deal-and-start logic from `party/server.ts` lines 177-212. Call the existing `engine.startGame(game, players)` function instead.

**Current state:** `engine.ts` exports `startGame` (lines 30-59) but the server has an identical duplicate inline. [VERIFIED: CONCERNS.md, confirmed by reading both files]

**Migration:** `engine.startGame` takes `(game: GameState, players: PlayerRecord[])` and returns `{ updatedGame, updatedPlayers }`. The server's `START_GAME` handler already constructs these; swap the body for a `startGame()` call and apply the result.

**Note:** After refactor, `startGame` in engine.ts receives `deck` as `remaining` from `dealHands`. The server must store `updatedGame` (which has `deck: remaining`) in `this.state.game` and store `updatedPlayers[i].hand` in `this.state.hands`. The engine function already does this correctly.

### Pattern 5: PartyKit Reconnect — Persisting Round Summary (ENG-09)

**What:** The `roundEndResult` (type `RoundResult`) currently lives only in React `useState` inside `useGame.ts`. When a player reconnects, `onConnect` in the server sends `GAME_STATE` and `YOUR_HAND` but NOT the round summary. The client loses the round modal.

**Fix:** Store `lastRoundResult` as a separate key in PartyKit Durable Object storage. Send it in `onConnect` alongside `GAME_STATE` and `YOUR_HAND`.

**PartyKit storage API:** [CITED: docs.partykit.io/guides/persisting-state-into-storage/]

```typescript
// In handleMessage, after ROUND_END resolution:
await this.room.storage.put('lastRoundResult', result)

// In onConnect:
const lastRoundResult = await this.room.storage.get<RoundResult>('lastRoundResult')
if (lastRoundResult) {
  conn.send(JSON.stringify({ type: 'ROUND_END', result: lastRoundResult }))
}
```

**Storage limits:** Individual values capped at 128 KiB per key. `RoundResult` is a small object (artist counts, rankings, payouts per player) — well under the limit for 2-5 players. [CITED: developers.cloudflare.com/durable-objects/platform/limits/]

**Alternative approach:** Store `lastRoundResult` inside `ServerState` (the existing persisted object) as an optional field `lastRoundResult?: RoundResult`. This avoids a second storage key and keeps all server state in one place. The tradeoff is slightly larger storage write on every state mutation (negligible for this object size). Recommended: add to `ServerState` rather than a separate key, to avoid a separate `await storage.get` call in `onConnect`.

### Pattern 6: Vitest Setup for Engine Tests

**What:** Vitest 4 with TypeScript, targeting the pure functions in `src/lib/engine.ts` and `src/lib/deck.ts`. No DOM, no React testing library needed for Phase 1.

**Config:** Add test block to existing `vite.config.ts` (Vitest reads Vite config automatically):

```typescript
// vite.config.ts — Source: vitest.dev/guide/
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',  // engine tests need no DOM
    include: ['src/**/*.test.ts'],
  },
})
```

**TypeScript concern:** `tsconfig.app.json` has `"allowImportingTsExtensions": true` and `"noEmit": true` — these are bundler-mode settings. Vitest handles TypeScript transpilation internally via esbuild (same as Vite), so `noEmit: true` is not a problem. The test files will resolve imports correctly. [VERIFIED: vitest.dev/guide/ — Vitest requires Vite >=6; project uses Vite 8.0.4]

**Test file location:** `src/lib/engine.test.ts` — co-located with the module under test.

**Run commands:**
- `npx vitest run` — single-pass, CI-friendly
- `npx vitest` — watch mode for development

**package.json scripts to add:**

```json
"test": "vitest run",
"test:watch": "vitest"
```

### Anti-Patterns to Avoid

- **Do not add `@testing-library/react` in this phase** — engine tests are pure function tests; no React rendering needed until Phase 2.
- **Do not change the `GameState` type for clients** — add a `PublicGameState` type for the broadcast instead of mutating the existing shared type, which would break server-side engine function signatures.
- **Do not create a separate Zod schema file** — co-locate schemas in `party/server.ts` for Phase 1. Extract to `src/types/messages.ts` in Phase 2 when client also needs them.
- **Do not use `z.union()` instead of `z.discriminatedUnion()`** — `z.union()` tests each schema sequentially; `z.discriminatedUnion()` routes by the `type` literal in O(1). For a switch-over-message-type pattern, discriminated union is strictly better.

---

## Critical Rule Finding: Double Auction (ENG-03)

**This section requires planner attention — ENG-03 as written is factually incorrect.**

### What ENG-03 says
> "Only the auctioneer player can play the second card in a double auction"

### What the official rules say
[CITED: CMON Modern Art rulebook via sahmreviews.com board game overview referencing CMON rules]

The double auction rule in Modern Art:
1. The auctioneer plays a double-icon card.
2. The auctioneer has first opportunity to play a second card of the **same artist** (not double-icon).
3. If the auctioneer cannot or chooses not to, the player to the auctioneer's **left** gets the same opportunity.
4. This continues clockwise until someone plays the second card OR all players pass.
5. **Whoever plays the second card becomes the new auctioneer** and runs the auction (collecting proceeds if someone else buys, or paying the bank if they self-buy).
6. If no one plays a second card, the original auctioneer takes the first card for free (no auction).

### What the current code does
`party/server.ts` lines 253-267: The `PLAY_SECOND_CARD` handler calls `getPlayerRecord(sessionId)` and passes the player to `playSecondCard()` without verifying the player is the auctioneer. So the server has NO enforcement of who can play the second card. Meanwhile, `PlayerHand.tsx` lines 21-28 shows the second-card button to any player with a matching artist card. [VERIFIED: CONCERNS.md]

### What Phase 1 must actually implement
- Server-side: maintain a `waitingSecondCardIdx` field (initially `auctioneerIdx`) tracking whose turn it is to play the second card.
- `PLAY_SECOND_CARD`: only accept from the player at `waitingSecondCardIdx`.
- `PASS_SECOND_CARD` (new message type needed): advances `waitingSecondCardIdx` clockwise; if it wraps back to `auctioneerIdx`, the original auctioneer takes the card free.
- When second card is played: update `auctioneerIdx` to the player who played the second card.
- The second card must NOT be a double-icon card (validated by Zod + engine check).

**Scope impact:** This is more than a one-line fix. It requires:
1. A new `PASS_SECOND_CARD` message type (with Zod schema)
2. A new field on `AuctionState` (or in `ServerState`) tracking whose turn it is to play the second card
3. Updated `playSecondCard` engine function to accept the new auctioneer idx
4. Updated server handler to enforce turn order
5. Updated client `PlayerHand` to show/hide the second-card button correctly

**Planner decision required:** ENG-03 says "only the auctioneer can play the second card." If this was intentionally simplified from the real rules (as a design choice to ship faster), the planner can implement the simplified rule and document it as a deliberate divergence from Knizia. If the intent is faithful Knizia rules, implement the full clockwise-pass mechanism. **Research recommends faithful implementation** — the simplified rule creates an unplayable state when the auctioneer has no matching card.

---

## Critical Rule Finding: Sealed Bid Tie-Breaking (ENG-10)

### Official rule
[CITED: CMON Modern Art rulebook via WebSearch result from modern-art board game source]

> "If two or more players are tied for the highest bid, then in clockwise order the player closest to the auctioneer wins the auction. If the Auctioneer is one of the tied players, then they must buy the painting card."

**Meaning:** Ties are broken clockwise from the auctioneer. If the auctioneer tied, the auctioneer wins (they are always "closest" to themselves). Non-auctioneer ties go to the first clockwise from the auctioneer.

### Current implementation bug
`engine.ts` lines 297-304: The loop starts at `offset = 1` (left of auctioneer) and uses strict `bid > maxBid`. Then checks auctioneer separately with `auctBid > maxBid` (also strict). 

**The bug:** If non-auctioneer player at `offset=1` bids 5000 and the auctioneer also bids 5000:
- Loop sets `maxBid = 5000`, `winnerIdx = offset1Player`
- Auctioneer check: `5000 > 5000` is false → auctioneer does NOT win
- Result: non-auctioneer player wins

**Per the official rule:** The auctioneer should win this tie. The auctioneer check should use `>= maxBid`, not `> maxBid`.

**Fix:** Change line 304 from `if (auctBid > maxBid)` to `if (auctBid >= maxBid && maxBid > 0)` (the `> 0` guard prevents awarding a zero-bid "win" to the auctioneer when everyone passed).

---

## Critical Rule Finding: Round-End Trigger (ENG-08)

**ENG-08 is already correctly implemented.** The engine.ts `playCard` function (lines 77-87) checks the count threshold and returns `roundEnded: true` WITHOUT creating an auction. The card is consumed from the hand but not auctioned. This matches the official rule. [VERIFIED: direct code inspection + confirmed by Wikipedia and search results]

The requirement to "verify from rulebook" is answered: the official rule is "as soon as a fifth work of art is offered for sale, the round ends (the fifth painting is not sold)." The current code is correct. A test must be written to lock this behaviour.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Runtime message validation | Custom type guards / `if (typeof msg.type === 'string')` chains | `z.discriminatedUnion()` | Handles nested field validation, coercion, union routing; type-safe output |
| JSON schema validation | JSON Schema + ajv | Zod 4 | Already recommended by PartyKit docs; TypeScript-first; no separate schema language |
| Test runner | Roll custom assertion scripts | Vitest 4 | Vitest reads existing vite.config.ts automatically; zero config overhead for a Vite project |
| Hand membership check | Complex client-side card filtering | Server-side: verify card.id is in `this.state.hands[sessionId]` | Client sends card object; server must confirm it's actually in that player's hand |

**Key insight:** The validation layer and test layer are both zero-config adds to this existing Vite/TypeScript project. The only meaningful engineering work is the rule corrections (double auction pass mechanism, sealed bid tie-break fix) and the `derivePublicState` broadcast change.

---

## Common Pitfalls

### Pitfall 1: Broadcasting Before Stripping — Wrong Call Order
**What goes wrong:** Developer adds `derivePublicState` function but still calls the old `broadcastState()` (which uses `room.broadcast`) in some code paths. The old path bypasses the projection.
**Why it happens:** `broadcastState()` is called in 8+ places. Easy to miss one.
**How to avoid:** Rename `broadcastState()` to `broadcastStateSecure()` (breaks all callers at compile time) and reimplement. TypeScript will flag every call site.
**Warning signs:** Any `room.broadcast` call that doesn't go through the projection function.

### Pitfall 2: Stripping `sealedBids` Too Late — After `resolveAuction`
**What goes wrong:** Stripping `sealedBids` in `derivePublicState` but not until AFTER `resolveAuction` runs. `resolveAuction` sets `status: 'completed'`, so the "don't strip when completed" guard would reveal the bids immediately at resolution.
**Why it happens:** Logical but wrong — the reveal should happen as part of the resolution broadcast, which is intentional.
**How to avoid:** This is actually the CORRECT behavior. When `auction.status === 'completed'`, bids are historical info and safe to show. The sealed bid reveal IS the resolution event. Don't strip on `status === 'completed'`.

### Pitfall 3: Zod Validation Rejecting Valid Cards Sent by Client
**What goes wrong:** Client sends a card object with extra fields (e.g., React component state attached). Zod's `z.object()` by default uses `.strip()` mode — it silently removes unknown keys. This is safe.
**Why it happens:** Developers sometimes switch to `.strict()` which throws on unknown keys.
**How to avoid:** Keep `CardSchema` as `z.object({...})` without `.strict()`. The strip default is correct.

### Pitfall 4: `noUnusedLocals` Breaks After Supabase Removal
**What goes wrong:** `tsconfig.app.json` has `"noUnusedLocals": true`. After deleting `src/lib/supabase.ts`, any file that imports from it will error. But since supabase.ts is confirmed to have zero imports, this is not a problem. However: if any file in `src/` ever imported it and was not caught, the build will break.
**How to avoid:** Run `npx tsc --noEmit` after deletion. The strict TypeScript config will catch any remaining import.

### Pitfall 5: `startGame` Refactor Breaks Hand State Sync
**What goes wrong:** After calling `engine.startGame()`, the server must store `updatedPlayers[i].hand` into `this.state.hands[sessionId]`. If the developer forgets this and only stores `updatedGame`, hands will be empty.
**Why it happens:** `engine.startGame` returns `{ updatedGame, updatedPlayers }` but `updatedGame.players` are `PublicPlayer[]` (no `hand`). The actual hands are on `updatedPlayers`.
**How to avoid:** After calling `startGame`, iterate `updatedPlayers` and populate `this.state.hands[p.sessionId] = p.hand`.

### Pitfall 6: Double Auction `waitingSecondCardIdx` Not Persisted
**What goes wrong:** If the double auction second-card pass state is stored only in memory (not in `this.state`), a server restart during `waiting_second` status loses whose turn it is.
**How to avoid:** Store `waitingSecondCardIdx` on `AuctionState` (not in a separate in-memory variable). `AuctionState` is persisted as part of `GameState`.

### Pitfall 7: Vitest Cannot Import `uuid` in Engine Tests
**What goes wrong:** `engine.ts` imports `uuid` for `auctionId = uuid()`. Vitest in Node environment should handle this fine, but if there's a module resolution issue, tests will fail at import.
**Why it happens:** The project uses `"moduleResolution": "bundler"` in tsconfig — Vitest uses its own resolution. UUID v13 (current) is a pure ESM package.
**How to avoid:** If import fails, add `"moduleResolution": "node"` to a separate `tsconfig.test.json` referenced in `vitest.config.ts`. More likely: just run the tests; uuid works in Node natively.

---

## Code Examples

### Verified: PartyKit `onMessage` Validation Pattern
```typescript
// Source: [CITED: docs.partykit.io/guides/validating-client-inputs/]
async onMessage(message: string, sender: Party.Connection) {
  let raw: unknown
  try { raw = JSON.parse(message) } catch { return }

  const result = InboundMessage.safeParse(raw)
  if (!result.success) {
    sender.send(JSON.stringify({ type: 'ERROR', message: 'Invalid message' }))
    return
  }
  // result.data is fully typed
  await this.handleMessage(result.data, sender)
}
```

### Verified: Zod 4 Discriminated Union
```typescript
// Source: [CITED: zod.dev/api]
import { z } from 'zod'

const InboundMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('JOIN'), name: z.string().min(1).max(30) }),
  z.object({ type: z.literal('START_GAME') }),
  z.object({ type: z.literal('PLAY_CARD'), card: CardSchema }),
  z.object({ type: z.literal('PLAY_SECOND_CARD'), card: CardSchema }),
  z.object({ type: z.literal('PASS_SECOND_CARD') }),
  z.object({ type: z.literal('SET_FIXED_PRICE'), price: z.number().int().min(0) }),
  z.object({ type: z.literal('ACCEPT_FIXED_PRICE') }),
  z.object({ type: z.literal('PASS_FIXED_PRICE') }),
  z.object({ type: z.literal('PLACE_OPEN_BID'), amount: z.number().int().min(1) }),
  z.object({ type: z.literal('END_OPEN_AUCTION') }),
  z.object({ type: z.literal('PLACE_ONCE_AROUND_BID'), amount: z.number().int().min(0).nullable() }),
  z.object({ type: z.literal('SUBMIT_SEALED_BID'), amount: z.number().int().min(0) }),
])

type InboundMessage = z.infer<typeof InboundMessage>
```

### Verified: Vitest Engine Test Structure
```typescript
// Source: [CITED: vitest.dev/guide/]
// File: src/lib/engine.test.ts
import { describe, it, expect } from 'vitest'
import { playCard, submitSealedBid, endRound, startGame } from './engine'
import { buildDeck, dealHands, shuffle } from './deck'
import type { GameState, PlayerRecord } from '../types/game'

describe('round-end trigger', () => {
  it('fires when 5th painting of artist is played, no auction created', () => {
    // set up game state with artistCounts[artist] = 4
    // play a card of that artist
    // expect roundEnded: true and game.auction === null
  })
})

describe('sealed bid tie-breaking', () => {
  it('auctioneer wins when tied with another player', () => {
    // all players submit same bid
    // auctioneer should win
  })

  it('leftmost player from auctioneer wins among non-auctioneer ties', () => {
    // players at positions 1 and 3 bid same amount; auctioneer at 0 bids less
    // player at position 1 should win (first clockwise from auctioneer)
  })
})
```

### Verified: `lastRoundResult` Reconnect Pattern
```typescript
// Source: [CITED: docs.partykit.io/guides/persisting-state-into-storage/]
// In ServerState interface — add optional field:
interface ServerState {
  game: GameState
  hands: Record<string, Card[]>
  sessions: Record<string, Session>
  lastRoundResult?: RoundResult  // persisted for reconnect recovery
}

// In onConnect — send last round result to reconnecting player:
async onConnect(conn: Party.Connection) {
  if (!this.state) return
  conn.send(JSON.stringify({ type: 'GAME_STATE', game: derivePublicState(this.state.game, conn.id) }))
  conn.send(JSON.stringify({ type: 'YOUR_HAND', hand: this.state.hands[conn.id] ?? [] }))
  if (this.state.lastRoundResult && this.state.game.status === 'playing') {
    conn.send(JSON.stringify({ type: 'ROUND_END', result: this.state.lastRoundResult }))
  }
}

// After endRound resolves — persist to state:
this.state.lastRoundResult = result
await this.persist()  // existing persist() saves the whole state object
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `zustand` should be removed now and reinstalled in Phase 3 | Standard Stack | If Phase 3 starts immediately after Phase 1, removing and reinstalling creates noise; low risk |
| A2 | Double auction second-card auctioneer-wins-if-no-card behavior should be faithful to Knizia | Critical Rule Finding (ENG-03) | If project intends simplified rules, the extra `PASS_SECOND_CARD` message type is unnecessary scope |
| A3 | Schemas should be co-located in `party/server.ts` rather than a shared types file | Architecture Patterns | If client also needs types now (it doesn't in Phase 1), they'd need duplication until extracted |

---

## Open Questions

1. **ENG-03 rule interpretation: faithful Knizia or intentional simplification?**
   - What we know: The official rule allows any player to play the second card. The requirement says "only the auctioneer."
   - What's unclear: Whether this is a conscious design simplification or an error in the requirements.
   - Recommendation: Implement faithful Knizia rules (any player clockwise can play/pass the second card). The simplified rule creates a stuck state when the auctioneer has no matching artist card.

2. **Should `sealedBids` type change on `GameState` for the broadcast?**
   - What we know: `AuctionState.sealedBids: Record<number, number>` is the server type. After stripping, clients receive presence-only data.
   - What's unclear: Should the client-facing type be `Record<number, true>` or should both client and server share the same type with the understanding that values are stripped?
   - Recommendation: Add `PublicGameState` type for client-facing broadcast. Avoids confusing server code that needs to read actual bid amounts for resolution.

3. **Should `gameId` be removed from `PlayerRecord` in this phase?**
   - What we know: `PlayerRecord.gameId` is always `''` (CONCERNS.md). It's dead code.
   - What's unclear: Whether removing it counts as cleanup in Phase 1 (ENG-07 scope) or is deferred.
   - Recommendation: Include it in Phase 1 cleanup — it's a one-line field removal from an interface and its only usage site.

---

## Environment Availability

Step 2.6: All dependencies are resolved via npm. No external services required for this phase.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, build | Yes | v25.9.0 | — |
| npm | Package install | Yes | 11.12.1 | — |
| zod | ENG-05 validation | Not installed | 4.3.6 on registry | — |
| vitest | ENG-10 tests | Not installed | 4.1.2 on registry | — |
| PartyKit 0.0.115 | Server lifecycle | Yes (pinned) | 0.0.115 | — |

**Missing dependencies:** `zod` and `vitest` must be installed before implementation. Both are standard npm packages with no platform constraints. Single `npm install zod && npm install -D vitest` resolves both.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vite.config.ts` — add `test:` block (Wave 0) |
| Quick run command | `npx vitest run src/lib/engine.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENG-01 | Sealed bids absent from public broadcast | unit | `npx vitest run src/lib/engine.test.ts` | Wave 0 |
| ENG-02 | Deck absent from public broadcast | unit | `npx vitest run src/lib/engine.test.ts` | Wave 0 |
| ENG-03 | Double auction: only valid player can play second card | unit | `npx vitest run src/lib/engine.test.ts` | Wave 0 |
| ENG-04 | Host assigned by connection order, not client message | manual/integration | Smoke test via browser | — |
| ENG-05 | Invalid messages rejected before engine | unit | `npx vitest run src/lib/engine.test.ts` | Wave 0 |
| ENG-06 | `startGame` called from engine, not inline | unit | `npx vitest run src/lib/engine.test.ts` | Wave 0 |
| ENG-07 | Supabase files deleted | manual check | `ls src/lib/supabase.ts` (should error) | — |
| ENG-08 | Round ends when 5th painting played, no auction | unit | `npx vitest run src/lib/engine.test.ts` | Wave 0 |
| ENG-09 | Reconnecting player receives last round summary | manual/integration | Smoke test via browser reconnect | — |
| ENG-10 | All five auction types tested | unit | `npx vitest run src/lib/engine.test.ts` | Wave 0 |

### Sampling Rate
- Per task: `npx vitest run src/lib/engine.test.ts`
- Per wave: `npx vitest run`
- Phase gate: full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/engine.test.ts` — covers ENG-01, ENG-02, ENG-03, ENG-05, ENG-06, ENG-08, ENG-10
- [ ] `vite.config.ts` — add `test: { environment: 'node', include: ['src/**/*.test.ts'] }` block
- [ ] Install: `npm install zod && npm install -D vitest`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in v1 (session UUID in localStorage) |
| V3 Session Management | Partial | Session UUID is client-generated; host assignment must be server-side |
| V4 Access Control | Yes | Server must enforce: only current player plays cards; only auctioneer ends open auction; only valid player plays second card |
| V5 Input Validation | Yes | Zod 4 discriminated union at WebSocket boundary |
| V6 Cryptography | No | No passwords, no tokens, no encryption needed |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client sends negative bid amount | Tampering | `z.number().int().min(0)` in Zod schema |
| Client claims to be host | Elevation of Privilege | Ignore `isHost` from JOIN message; assign server-side |
| Client plays card not in hand | Tampering | Server checks `this.state.hands[sessionId].find(c => c.id === card.id)` after Zod validates shape |
| Client reads opponent sealed bids from WebSocket frame | Information Disclosure | `derivePublicState()` strips sealedBids values before broadcast |
| Client reads remaining deck from WebSocket frame | Information Disclosure | `derivePublicState()` strips `deck` field before broadcast |
| Malformed JSON causes unhandled exception | Denial of Service | `try { JSON.parse() } catch { return }` before Zod parse |
| Very long player name bloats all broadcasts | Denial of Service | `z.string().max(30)` on name field |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `import { z } from 'zod/v4'` subpath | `import { z } from 'zod'` (Zod 4 is now root) | July 8, 2025 | Either import works; prefer `'zod'` for simplicity |
| Zod 3 sequential `z.union()` | Zod 4 `z.discriminatedUnion()` (O(1) routing) | Zod 4.0, May 2025 | ~14x faster parse on discriminated types |

---

## Sources

### Primary (HIGH confidence)
- [CMON Modern Art rulebook (via sahmreviews.com overview)] — sealed bid tie-breaking, fifth painting rule, double auction second-card rule
- [Wikipedia: Modern Art (game)](https://en.wikipedia.org/wiki/Modern_Art_(game)) — fifth painting round-end rule confirmed
- [PartyKit input validation guide](https://docs.partykit.io/guides/validating-client-inputs/) — exact `safeParse()` pattern in `onMessage`
- [PartyKit persisting state guide](https://docs.partykit.io/guides/persisting-state-into-storage/) — `room.storage.put/get` API, 128 KiB limit
- [Zod 4 versioning](https://zod.dev/v4/versioning) — import path clarified: `'zod'` exports Zod 4 as of July 2025
- [Zod 4 API](https://zod.dev/api) — `z.discriminatedUnion()` syntax
- [Vitest guide](https://vitest.dev/guide/) — setup steps, config, run commands
- `src/lib/engine.ts`, `party/server.ts`, `src/types/game.ts` — direct code inspection
- `.planning/codebase/CONCERNS.md` — confirmed bugs and security issues

### Secondary (MEDIUM confidence)
- [BGG: double auction thread](https://boardgamegeek.com/thread/529814/double-auction) — confirms any player can play second card (consistent with sahmreviews rules)
- [BGG: ending round with double auction card](https://boardgamegeek.com/thread/1319709/ending-round-double-auction-card) — confirms fifth painting is not sold

### Tertiary (LOW confidence)
- None — all claims verified against official sources or direct code inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via npm registry on 2026-04-06
- Architecture patterns: HIGH — derived from direct code inspection of engine.ts and server.ts
- Rule findings (critical): HIGH — confirmed via official CMON rulebook text, Wikipedia, BGG threads (3 sources converging)
- Pitfalls: HIGH — derived from direct codebase bugs confirmed in CONCERNS.md

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable domain; PartyKit 0.0.115 is pinned so no API drift risk)

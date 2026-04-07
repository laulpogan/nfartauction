# Domain Pitfalls

**Domain:** Multiplayer browser board game + gallery sim (NFArt / Modern Art)
**Researched:** 2026-04-06

---

## Critical Pitfalls

Mistakes that cause rewrites or break core game mechanics.

---

### Pitfall 1: Sealed Bid Values in Public Broadcast (Already Present)

**What goes wrong:** `AuctionState.sealedBids` is a `Record<number, number>` containing actual bid amounts. It is included in `this.state.game` and broadcast verbatim to all clients via `broadcastState()` in `party/server.ts` line 396. Any player can read every opponent's sealed bid from their WebSocket message before the reveal, breaking the entire sealed-bid auction type.

**Why it happens:** The server holds one canonical game state object and broadcasts it without stripping private sub-fields. The UI was built to only display a presence indicator (bid submitted yes/no), so the bug is invisible without reading the raw WebSocket frame.

**Consequences:** Sealed-bid auctions become first-price open auctions. The mechanic is meaningless. Players with devtools open gain permanent structural advantage.

**Prevention:**
- Create a `derivePublicState(state, playerId)` projection function on the server.
- For sealed bids: replace `sealedBids: Record<number, number>` in the broadcast with `sealedBidsSubmitted: Set<number>` (presence only, no amounts).
- Only broadcast actual bid amounts after `resolveSealedBids` is called, inside the resolution result message.
- Test: write a unit test that calls `derivePublicState` for player A and asserts player B's bid amount is absent.

**Detection:** Open browser devtools, join a room, watch the raw WebSocket messages during a sealed-bid auction. Bid amounts for all players are visible in the JSON payload.

---

### Pitfall 2: Deck Exposed in Public GameState Broadcast (Already Present)

**What goes wrong:** `GameState.deck` (all remaining undealt cards, in order) is included in the broadcast object. Any client can read upcoming cards before they are dealt.

**Why it happens:** Same root cause as Pitfall 1 — no projection layer between canonical server state and client-bound broadcast.

**Consequences:** Players can see exactly which artist cards remain. This directly distorts bidding strategy and breaks the card-uncertainty premise of the game. In a 70-card deck the strategic advantage is significant by round 3-4.

**Prevention:** Strip `deck` entirely from the broadcast. The deck is server-only state. Clients only need their own hand (`YOUR_HAND` message, already implemented as a separate send).

**Detection:** Read the `GAME_STATE` WebSocket message during an active game. `deck` field will be present and populated.

---

### Pitfall 3: Race Condition on Simultaneous Sealed Bid Submission

**What goes wrong:** If two players submit sealed bids at near-identical timestamps, their `SUBMIT_SEALED_BID` messages hit the server in rapid succession. Because the Durable Object is single-threaded and processes requests sequentially, this is not a true race — but the tie-breaking logic in `submitSealedBid` (engine.ts lines 293-312) has a bug: it iterates from `offset = 1` (left of auctioneer) using strict `>`, and then checks the auctioneer separately also with strict `>`. Equal bids from two non-auctioneers go to the leftmost. The auctioneer cannot win a tie with any non-auctioneer — they can only win a tie with other non-auctioneers if their bid is strictly higher than all of those.

**Why it happens:** The Knizia rules state that tied sealed bids go to the player sitting to the left of the auctioneer (BGG consensus). The current implementation is close but the auctioneer edge case has not been verified against the rulebook. The logic was never tested.

**Consequences:** Incorrect auction winner in tie scenarios. The bug is probabilistically rare but deterministic given the right inputs — it will occur in playtesting.

**Prevention:**
- Write parameterised unit tests for `submitSealedBid` covering: two equal bids (non-auctioneer wins leftmost), auctioneer ties with leftmost player (auctioneer should lose), all-equal bids (leftmost non-auctioneer wins), auctioneer bids highest (auctioneer wins).
- Verify the correct rule against the official Modern Art rulebook before finalising the implementation.

**Detection:** Unit test. Not detectable through UI alone without injecting crafted game state.

---

### Pitfall 4: Host Privilege Assigned From Client-Sent Flag

**What goes wrong:** The `isHost` flag in the `JOIN` WebSocket message is read from the client payload (`party/server.ts` line 111) and accepted for the first connecting player. Any client that connects first and sends `isHost: true` gains the ability to call `START_GAME`.

**Why it happens:** The server assigns `isHost: false` for subsequent players (line 155) correctly, but trusts the first-joiner's self-reported value.

**Consequences:** A player who knows the room code and connects a fraction of a second before the intended host gains host control. In a 4-character code namespace this is not a hypothetical — anyone who can guess or share the code can race for host.

**Prevention:** Ignore `isHost` from all client payloads entirely. Assign `isHost: true` server-side to the first player whose `onConnect` fires (connection order is deterministic in a single Durable Object). Remove the `isHost` field from all client-bound JOIN messages.

---

### Pitfall 5: Round-End Trigger on the Fifth Card Auction (Not Fifth Card Played)

**What goes wrong:** The Knizia rule is precise: the round ends when the **fifth painting of any artist is put up for auction** — that fifth painting is NOT sold. If the `endRound` trigger fires after the auction resolves (i.e., after the fifth card is sold), the player who triggers the round-end by auctioning a fifth card incorrectly profits from that sale.

**Why it happens:** Digital implementations commonly trigger round-end on resolution rather than on card-play, because the "auction resolved" event is easier to hook into. The engine's `playCard` or equivalent must check the threshold before starting the auction for that card, not after.

**Consequences:** Scoring is wrong for the round-ending player in every game. This is a fundamental rules violation that compounds across four rounds.

**Prevention:**
- Check the fifth-card threshold in `playCard` (before auction creation), not in `resolveAuction`.
- Unit test: deal a state where four Lite Metal cards have been auctioned; play a fifth Lite Metal card; assert `status === 'round_over'` and assert the fifth card was not resolved through an auction winner.

---

### Pitfall 6: Double Auction Second Card Open to All Players (Already Present)

**What goes wrong:** During `waiting_second` status, `PlayerHand.tsx` renders the "Play 2nd Card" action for any player holding a matching artist card, and the server does not validate that `PLAY_SECOND_CARD` was sent by the auctioneer. Any player can hijack the second-card slot.

**Consequences:** Non-auctioneer players can redirect the double auction, changing who benefits from the combined sale. This is a rules violation and corrupts game state permanently.

**Prevention:** Server-side enforcement only. On receiving `PLAY_SECOND_CARD`, check `msg.playerId === auction.auctioneerIdx` (or equivalent connection ID check). Reject with an `ERROR` message otherwise. Also fix the client-side guard in `PlayerHand.tsx` to only render the action for the current auctioneer.

---

## Moderate Pitfalls

Mistakes that cause incorrect behaviour or poor user experience but do not require a full rewrite.

---

### Pitfall 7: Reconnect Drops Round-End Modal State

**What goes wrong:** `roundEndResult` is held only in React component state (`useState`). If a player's WebSocket disconnects and reconnects during or after a round transition, the server sends `GAME_STATE` and `YOUR_HAND` on reconnect, but there is no mechanism to re-send the round summary. The reconnected player sees the current game state without knowing what just resolved.

**Why it happens:** Ephemeral UI state is not persisted on the server. The `roundEndResult` object is derived from a server event at resolution time and never stored in the Durable Object.

**Prevention:**
- Store `lastRoundResult` in the Durable Object's persisted state (it is small — a few artist names and numbers).
- On reconnect (`onConnect`), include `lastRoundResult` in the `GAME_STATE` payload if `status === 'between_rounds'`.
- Alternatively, add a `ROUND_RESULT` message type that the client re-requests on reconnect.

---

### Pitfall 8: Full GameState Broadcast on Every Action Grows With roundHistory

**What goes wrong:** Every player action triggers `broadcastState()` which serialises and sends the full `this.state.game` object to all connected clients. `GameState.roundHistory` accumulates every resolved auction across all four rounds. By round 4 the payload can be 20-40 KB per action.

**Why it happens:** No diffing or partial-update mechanism. Single broadcast function called unconditionally.

**Consequences:** Latency degrades perceptibly in rounds 3-4 on mobile or congested networks. On a 2-player game with ~30 actions per round and 4 rounds, this is ~120 full-state broadcasts. On 4 players it is the same broadcast volume but 4× the recipient bandwidth.

**Prevention:**
- Send lightweight action events (e.g., `{ type: 'BID_PLACED', playerId, amount }`) for state changes that do not alter the structural shape.
- Reserve full `GAME_STATE` broadcast for structural transitions (round start, auction resolution, game over).
- Alternatively, keep full broadcast but strip `roundHistory` from the real-time payload and send it only on explicit request or at modal-open time.

---

### Pitfall 9: PartyKit KV Storage 128 KiB Per-Value Limit

**What goes wrong:** PartyKit's Durable Object `storage.put(key, value)` enforces a 128 KiB limit per value (legacy KV backend). If the entire `GameState` object is stored under a single key (e.g., `storage.put('game', this.state.game)`) and `roundHistory` grows large, the put will throw a runtime exception and game state will not be persisted. A reconnecting player will load stale or empty state.

**Why it happens:** The natural pattern is to store the whole state object under one key. The limit is not surfaced as a TypeScript type error — it is a runtime throw.

**Consequences:** Silent persistence failure. The Durable Object keeps the in-memory state intact while it is running, so active players see no error. After a DO eviction or cold start, state is lost.

**Prevention:**
- Split state into separate keys: `storage.put('players', ...)`, `storage.put('auction', ...)`, `storage.put('roundHistory', ...)`.
- Add a size guard: `JSON.stringify(value).length > 100_000` → log a warning before the put.
- The new PartyServer API (Cloudflare `partyserver` package) may use the SQLite backend (2 MB row limit), but verify before relying on this — the current codebase is on the legacy PartyKit `0.0.115` SDK.

---

### Pitfall 10: Connection State (setState) 2 KB Limit

**What goes wrong:** PartyKit's per-connection `setState()` API has a hard 2 KB limit. Storing anything beyond a player identifier or session token there throws silently or is truncated.

**Why it happens:** Developers use `setState` for convenience to associate player data with a connection. Game state stored there instead of `room.storage` exceeds the limit immediately.

**Prevention:** Use `setState` only for minimal connection metadata (playerId, name, sessionId). All game state goes in `room.storage`. This is already the pattern in the codebase but is worth protecting as the codebase grows.

---

### Pitfall 11: Simultaneous RoundEndModal + GameOverModal Render

**What goes wrong:** `GameBoard.tsx` guards `RoundEndModal` with `game.status !== 'game_over'`, but the status update and the `roundEndResult` state update arrive via two separate React state dispatches triggered by one WebSocket message. Depending on React 19 batching behaviour, there is a render window where both modals attempt to mount.

**Why it happens:** Two pieces of state (`roundEndResult` from a `ROUND_END` message and `game.status` from a `GAME_STATE` message) are updated asynchronously and are not atomically coordinated.

**Prevention:**
- Derive `showRoundEndModal` from a single source: `roundEndResult !== null && game.status === 'between_rounds'`.
- Derive `showGameOverModal` from `game.status === 'game_over'`.
- These are mutually exclusive if `between_rounds` and `game_over` are distinct status values (which they should be).
- Ensure the server only ever sends `ROUND_END` before transitioning `status` to `game_over` — never both in the same message sequence.

---

### Pitfall 12: No Input Validation Opens Engine to Corrupted State

**What goes wrong:** All WebSocket message fields are cast directly (`msg.card as Card`, `msg.amount as number`) without runtime validation. A malicious or buggy client can send `{ type: 'SUBMIT_SEALED_BID', amount: -50000 }` or a card object not in the player's hand.

**Consequences:** The engine may accept negative bids (player gains money by bidding), accept cards not in hand (card duplication), or receive non-numeric amounts that coerce to `NaN` and break arithmetic permanently for that game session.

**Prevention:**
- Add Zod schemas for every incoming message type. Parse at the top of `onMessage`; reject with `ERROR` if parse fails.
- Add a server-side hand ownership check before any `PLAY_CARD` or `PLAY_SECOND_CARD` action.
- Clamp `amount` to `[0, player.money]` on the server before passing to engine functions.

---

## Minor Pitfalls

Mistakes that cause friction or confusion but are recoverable.

---

### Pitfall 13: Sim Economy Imbalance by Design — Don't Try to Fix It

**What goes wrong:** The gallery sim's shared economy (auction winnings funding sim costs) will not balance cleanly. Sim costs (travel time slots, drug inventory, landlord rent) drain resources that auction strategy requires. This is not a bug; it is the design tension.

**What to avoid:** Attempting to solve the balance mathematically during implementation will stall development. The numbers are placeholder until playtesting reveals player behaviour. The risk is that developers over-engineer the economy formula before any human has played a session.

**Prevention:**
- Hard-code simple linear costs for v1 (time slot = fixed $X, travel = fixed $Y per neighbourhood).
- Expose economy constants as a config object, not magic numbers scattered through the sim engine.
- Add a dev-mode "economy log" that prints each transaction to the console so playtesting can surface imbalance quickly.
- Accept that the economy will feel wrong in v1. Build the loop, then tune the numbers.

---

### Pitfall 14: Relationship Decay Curves Feel Punishing When They Are Linear

**What goes wrong:** Linear decay (relationship score -= N per round) feels arbitrary and punishing because the relationship drops the same amount whether the player is actively engaged or not. Players who miss one round of interaction lose the same relationship value as players who have never interacted.

**Why it happens:** Linear is the default implementation. It is also the most noticeable decay pattern — players perceive it as "the game punishing me for not clicking enough."

**Prevention:**
- Use exponential decay to a floor: `score = max(floor, score * decayFactor)`. This means relationships degrade quickly when high (plenty of attention expected) and more slowly when low (acquaintance level is easier to maintain).
- Set the floor above zero (e.g., 10 out of 100) so relationships never fully die from neglect alone — only from active negative events.
- Decay should trigger on round transitions (discrete), not on a real-world timer. Timer-based decay in a game session causes confusion: players who pause the game lose relationship value.
- Cap the mechanic for v1: relationships affect bid likelihood by ±10-15%, not a binary on/off. This limits the punishing feel even if the curve is imperfect.

---

### Pitfall 15: NFT Layer Unlock at Coolness Threshold — Avoid Double-Economy Complexity in v1

**What goes wrong:** The NFT parallel economy introduces a second currency with a volatile exchange rate. If the exchange rate is implemented before the base economy is stable, two broken economies compound each other. Debugging becomes impossible.

**Prevention:**
- Build the NFT unlock as a visual/narrative layer first: different UI skin, different copy, same underlying money variable.
- Only introduce the separate NFT balance if the base economy is stable and the Coolness threshold unlock has been playtested.
- The volatile exchange rate should be a config multiplier, not a derived formula, until the base game is working.

---

### Pitfall 16: Duplicate `app/` Directory Causes Wrong-File Edits

**What goes wrong:** The repository contains a mirrored `app/` subdirectory. Any editor or tool that does a directory-wide search (grep, IDE indexing, AI coding assistants) may open and edit the wrong copy. Changes made to `/app/src/` are invisible to the running Vite/PartyKit process which reads from the root `/src/` and `/party/`.

**Prevention:**
- Delete `app/` before any substantive development begins. It is confirmed non-canonical (`partykit.json` at root points to `party/server.ts`).
- Run `git ls-files app/` to confirm the directory is tracked, then remove it in a single cleanup commit.

---

### Pitfall 17: partykit `0.0.115` API Shape May Break Without Warning

**What goes wrong:** PartyKit is pre-1.0. Minor version bumps have historically included breaking changes to server lifecycle hooks and storage API shapes. The `onConnect`, `onMessage`, `onClose` signatures have changed between minor versions.

**Prevention:**
- Pin the exact version: `"partykit": "0.0.115"` (already using exact pinning in the lockfile, but verify `package.json` does not use `^`).
- Do not run `npm update` without reading the PartyKit changelog for every version between the current pin and the target.

---

### Pitfall 18: `startGame` Logic Duplication Between Engine and Server

**What goes wrong:** `engine.ts` exports a `startGame` function that is not called by the server. The server duplicates the dealing logic inline. When dealing rules change (e.g., player count variant, card count per artist), only one copy gets updated.

**Prevention:**
- The server should import and call `startGame` from `engine.ts`. The engine function is pure (state-in/state-out) and already has the correct signature.
- Delete the inline duplicate from `party/server.ts` after consolidation.
- This is a precondition for trustworthy engine tests — if the server uses different logic than the engine, tests of the engine function do not validate what runs in production.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Engine audit + security fixes | Pitfall 1 (sealed bid leak), Pitfall 2 (deck leak) | Implement `derivePublicState(state, playerId)` before any other work — all other fixes build on top of this |
| Engine test suite | Pitfall 3 (tie-breaking), Pitfall 5 (round-end trigger) | Write tests before fixing; tests confirm the current bug, then the fix makes them pass |
| Sealed bid resolution | Pitfall 3 (tie-breaking logic) | Cross-reference Knizia rulebook; do not guess the tiebreak rule |
| Double auction enforcement | Pitfall 6 (any player can play second card) | Server-side check required; client-side guard alone is not sufficient |
| Reconnect / session recovery | Pitfall 7 (round modal lost), Pitfall 9 (KV size) | Persist `lastRoundResult` in storage; split state into multiple keys |
| Gallery sim loop | Pitfall 13 (economy imbalance) | Config-object constants; dev-mode transaction log; do not balance in code |
| Relationship system | Pitfall 14 (linear decay feels punishing) | Exponential decay to a floor; discrete (round-transition) decay, not real-time |
| NFT layer | Pitfall 15 (double economy complexity) | Narrative/visual unlock first; separate balance second |
| Deployment | Pitfall 16 (app/ dir), Pitfall 17 (PartyKit pre-1.0) | Clean repo before deploy; pin exact versions |

---

## Sources

- Cloudflare Durable Objects Limits (official): https://developers.cloudflare.com/durable-objects/platform/limits/
- PartyKit Storage Docs: https://docs.partykit.io/guides/persisting-state-into-storage/
- PartyKit Server API: https://docs.partykit.io/reference/partyserver-api/
- Modern Art rulebook (PDF): https://www.base23.com/rulebooks/ma_rulebook_3rd_EN.pdf
- Modern Art BGG entry: https://boardgamegeek.com/boardgame/118/modern-art
- Cloudflare Durable Objects Best Practices: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Game Design — Decay, Resets, and Entropy: https://www.gamedeveloper.com/design/decay-resets-and-entropy
- WebSocket Security (OWASP): https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html
- Codebase concerns audit: .planning/codebase/CONCERNS.md (2026-04-06)
- Project definition: .planning/PROJECT.md (2026-04-06)

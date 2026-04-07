# Codebase Concerns

**Analysis Date:** 2026-04-06

## Tech Debt

**Dead Supabase module:**
- Issue: `src/lib/supabase.ts` is a fully-implemented Supabase client with 7 DB helper functions that is never imported anywhere. The project was migrated from Supabase to PartyKit (commit `bb5e6d2`) but this file was left behind. It also initialises a Supabase client using `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars that are no longer needed.
- Files: `src/lib/supabase.ts`
- Impact: Dead code bloat; env var confusion if someone tries to deploy without Supabase credentials (undefined values passed to `createClient`).
- Fix approach: Delete `src/lib/supabase.ts` and remove `@supabase/supabase-js` from `package.json` dependencies.

**Orphaned `supabase_migration.sql`:**
- Issue: The SQL migration file for the old Supabase backend remains in the root. It defines tables, RLS policies, and realtime config that are unused by the current PartyKit backend.
- Files: `supabase_migration.sql`, `app/supabase_migration.sql` (duplicate in nested `app/` dir)
- Impact: Confusing to new contributors; the permissive RLS comment ("Allow all — no auth required") documents a conscious security trade-off that no longer applies.
- Fix approach: Delete both files.

**Unused `zustand` dependency:**
- Issue: `zustand` v5 is listed in `package.json` dependencies but is not imported anywhere in `src/`.
- Files: `package.json`
- Impact: Unnecessary bundle weight and a misleading dependency footprint.
- Fix approach: Remove `zustand` from `package.json` and run `npm install` to update the lockfile.

**`startGame` engine function is unreachable:**
- Issue: `src/lib/engine.ts` exports a `startGame` function (lines 30-59) that is not imported by the server or any client module. The server duplicates its logic inline at `party/server.ts` lines 177-212.
- Files: `src/lib/engine.ts` (lines 30-59), `party/server.ts` (lines 177-212)
- Impact: Logic duplication; if dealing rules change the server copy must also be updated manually.
- Fix approach: Either call `startGame` from the server, or remove it from `engine.ts`.

**`PlayerRecord.gameId` is always empty string:**
- Issue: The `gameId` field on `PlayerRecord` (defined in `src/types/game.ts` line 69) is always set to `''` in `party/server.ts` line 35 (`gameId: ''`). This is a leftover from the Supabase era when game IDs lived in a database.
- Files: `src/types/game.ts`, `party/server.ts`
- Impact: Misleading type; the field serves no purpose in the PartyKit model.
- Fix approach: Remove `gameId` from `PlayerRecord`.

**Duplicated project root vs `app/` subdirectory:**
- Issue: The repository contains a top-level project root (with `package.json`, `src/`, `party/`, etc.) and an identical `app/` subdirectory that mirrors every source file. This appears to be an incomplete restructuring where the code was moved into `app/` but the originals were not deleted.
- Files: `/app/src/`, `/app/party/`, `/app/package.json` vs `/src/`, `/party/`, `/package.json`
- Impact: Confusion about which copy is canonical; changes applied to one root will not appear in the other.
- Fix approach: Determine which root is the live one (the top-level root, based on `partykit.json` pointing to `party/server.ts`) and delete the `app/` subdirectory, or vice-versa.

**`dist/` directory is present but not `.gitignored` at root:**
- Issue: The root `.gitignore` lists `dist/` but the `dist/` directory exists on disk and contains compiled assets. If it was ever committed it represents stale build output in the repo.
- Files: `/dist/`, `/.gitignore`
- Impact: Stale build artifacts may be served instead of a fresh build; increases repo size.
- Fix approach: Confirm `dist/` is not tracked (`git ls-files dist/`) and ensure the build step always regenerates it.

---

## Security Considerations

**Sealed bids are broadcast to all clients:**
- Risk: `AuctionState.sealedBids` is a `Record<number, number>` that stores actual bid amounts. This field lives inside `this.state.game` which is broadcast verbatim to every connected client via `broadcastState()` (`party/server.ts` line 396). Any client can read every other player's sealed bid from the WebSocket message, breaking the sealed-bid auction mechanic.
- Files: `party/server.ts` (line 396), `src/types/game.ts` (line 39)
- Current mitigation: The UI only shows whether a bid has been submitted (not the amount), but the raw data is in every client's received message.
- Recommendations: Strip `sealedBids` values (keep only keys/presence) from the public `GameState` before broadcasting, or use a separate `sealedBidsSubmitted: Set<number>` field for the public state. Only reveal amounts after resolution.

**No input validation on WebSocket messages:**
- Risk: The server casts all incoming message fields directly (`msg.card as Card`, `msg.amount as number`, `msg.name as string`) with zero runtime validation (`party/server.ts` lines 110-354). A malicious client can send crafted JSON to trigger engine exceptions or corrupt game state (e.g., negative bid amounts, arbitrary card objects not in the player's hand).
- Files: `party/server.ts`
- Current mitigation: Exceptions thrown by engine functions are caught and returned as `ERROR` messages, which prevents a hard crash, but state may already be corrupted before the throw.
- Recommendations: Add a validation layer (e.g., Zod schemas) to parse and validate each message type before passing to engine functions. Verify that the card being played is actually in the player's hand on the server side.

**Host privilege is client-declared:**
- Risk: The `isHost` flag sent in the `JOIN` message (`party/server.ts` line 111) is trusted as-is from the client. A joining player can set `isHost: true` in their JOIN payload and gain the ability to start the game.
- Files: `party/server.ts` (lines 109-117), `src/hooks/useGame.ts` (lines 43-44)
- Current mitigation: The first player to create the room is always assigned `isHost: true` server-side regardless (line 117), and subsequent players are assigned `isHost: false` (line 155). However, the client-sent `isHost` value is read and accepted for the first player only, meaning any first-connector can claim host.
- Recommendations: Ignore the `isHost` field from the client entirely. Assign host status server-side based purely on connection order.

**Player name is uncapped and unsanitised:**
- Risk: `msg.name as string` is stored and broadcast without length limits or sanitisation (`party/server.ts` line 110). Very long names would bloat all broadcast payloads; names containing HTML or script tags could cause issues if the app ever server-side renders or logs to an unsanitised surface.
- Files: `party/server.ts` (line 110)
- Recommendations: Add a `maxLength` cap (e.g., 30 chars) and strip non-printable characters server-side.

---

## Known Bugs / Fragile Areas

**Double auction: any player can play the second card, not just the auctioneer:**
- Symptoms: When a double auction is in `waiting_second` status, the `PlayerHand` component allows any player who holds a matching artist card to play it (`src/components/game/PlayerHand.tsx` lines 28, 81). There is no server-side enforcement limiting `PLAY_SECOND_CARD` to the auctioneer.
- Files: `src/components/game/PlayerHand.tsx` (lines 21-28), `party/server.ts` (lines 253-267)
- Trigger: Non-auctioneer player with a matching card clicks "Play 2nd Card" during a double auction.
- Workaround: None; this can produce incorrect game state.

**`deck` field is included in the public `GameState` broadcast:**
- Symptoms: `GameState.deck` (all remaining undealt cards) is part of the object broadcast to every player. Any client can inspect the full remaining deck before it is dealt, giving a strategic advantage.
- Files: `src/types/game.ts` (line 62), `party/server.ts` (line 396)
- Workaround: None currently implemented.

**`onceAroundCurrentIdx` wraps back to auctioneer, not start-of-round:**
- Symptoms: `getNextOnceAroundIdx` in `src/lib/engine.ts` (line 449) uses simple modulo: `(currentIdx + 1) % playerCount`. For once-around bidding the auctioneer bids last and their turn is detected by `isLastBidder = bidderIdx === auction.auctioneerIdx` (line 255). If the auctioneer is at position 0 and there are 3 players, the order is 1 → 2 → 0. However, initial `onceAroundCurrentIdx` is set to `(auctioneerIdx + 1) % playerCount` (line 108), which is correct. The logic is sound but is easy to break if player ordering changes during a round.
- Files: `src/lib/engine.ts` (lines 108, 244-275, 449)

**`RoundEndModal` and `GameOverModal` are both rendered simultaneously on game over:**
- Symptoms: In `src/components/game/GameBoard.tsx` (lines 138-143), `RoundEndModal` is conditionally rendered when `roundEndResult` exists AND `game.status !== 'game_over'`. But when the last round ends, `roundEndResult` is set and `status` briefly transitions to `game_over`, which means `GameOverModal` renders while `RoundEndModal` may also still be mounted (depending on React re-render timing and whether `setRoundEndResult` was called before status update). The round-end result dismissal ("See Final Scores" button) navigates to the game-over modal.
- Files: `src/components/game/GameBoard.tsx` (lines 138-143), `src/components/game/RoundEndModal.tsx`
- Workaround: The conditional `game.status !== 'game_over'` prevents most overlap, but state sequencing via WebSocket is not guaranteed.

**No reconnection handling if WebSocket closes mid-game:**
- Symptoms: `useGame.ts` sets `connected = false` on WebSocket `close` event (line 55) but takes no further action. The PartySocket library handles reconnection under the hood, but if reconnect succeeds and a new `onConnect` fires in the server, only `GAME_STATE` and `YOUR_HAND` are sent — `roundEndResult` (held only in React state) is lost.
- Files: `src/hooks/useGame.ts` (lines 55-63), `party/server.ts` (lines 87-94)
- Impact: A player who reconnects after a round ends will not see the round summary.

---

## Performance Bottlenecks

**Full game state broadcast on every action:**
- Problem: Every single game action (bid placed, card played, price passed, etc.) triggers a full `this.state.game` broadcast to all players (`party/server.ts` broadcastState is called after every handler). The `GameState` object can be large once `roundHistory` accumulates multiple rounds.
- Files: `party/server.ts` (lines 394-397)
- Cause: No diffing or partial update mechanism.
- Improvement path: Send lightweight event messages for minor state changes (e.g., `BID_PLACED`) and only broadcast full state on structural changes (round transitions, auction resolution).

---

## Test Coverage Gaps

**No tests exist:**
- What's not tested: Entire codebase — game engine logic, auction resolution, deck dealing, scoring, server message routing, and all React components.
- Files: `src/lib/engine.ts`, `src/lib/deck.ts`, `party/server.ts`, all `src/components/`
- Risk: Game logic bugs (especially edge cases in once-around resolution, sealed bid tie-breaking, and double auction second-card rules) can ship undetected.
- Priority: High — `src/lib/engine.ts` is pure functions with deterministic inputs and is the highest-value testing target.

**Engine tie-breaking in sealed bids is not verified:**
- What's not tested: `submitSealedBid` in `src/lib/engine.ts` (lines 279-316) implements tie-breaking by iterating from the left of the auctioneer. The auctioneer is then checked separately (lines 303-304), which means the auctioneer only wins a tie if their bid strictly exceeds all others — but the loop starting at `offset = 1` uses `bid > maxBid` (strict), so equal bids from non-auctioneers go to the leftmost. The auctioneer check afterward is also strict. This may not match the intended board game rules.
- Files: `src/lib/engine.ts` (lines 293-312)
- Priority: Medium.

---

## Dependencies at Risk

**`partykit` is pre-1.0 (`0.0.115`):**
- Risk: The PartyKit server SDK is at `0.0.115` — API shape may change in breaking ways without a major version bump.
- Impact: Server code in `party/server.ts` may need updates on any dependency upgrade.
- Migration plan: Pin the exact version; audit release notes before upgrading.

**`vite` at v8 (pre-stable):**
- Risk: `vite` `^8.0.4` is a very recent major version. Ecosystem plugin compatibility (notably `@vitejs/plugin-react` at `^6.0.1`) may lag.
- Impact: Build failures or silent behavioural changes during `npm install` if a newer minor is pulled in.
- Migration plan: Pin exact version in `package.json` or move to `~` rather than `^`.

**`typescript` at `~6.0.2`:**
- Risk: TypeScript 6.x is a new major with potential breaking changes to type inference.
- Impact: Upgrading other dependencies that include `.d.ts` types may trigger type errors.
- Migration plan: Monitor ecosystem compatibility; pin with `~` (already done) which is appropriate.

---

*Concerns audit: 2026-04-06*

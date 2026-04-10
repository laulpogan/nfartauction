# Phase 7: Bot Players - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Source:** Direct user request during playtesting

<domain>
## Phase Boundary

Add configurable AI bot players that participate in auctions and the sim loop. Bots are server-side virtual players — no client code, no WebSocket connections. They respond to game state (market hotness, artist valuations, their own money) and keep auctions competitive even with few human players. Enables solo play.

In scope:
- Host configures bot count (0-3) in lobby
- 3 bot personality profiles: conservative, aggressive, erratic
- Bots play cards on their turn (artist selection strategy)
- Bots bid in all 5 auction types (bid strategy responds to game state)
- Bots submit sim day time slots (strategy weighted by personality)
- All bot logic is server-side in party/server.ts (or a new bot-engine.ts)
- Bots appear as named players in the game — indistinguishable from humans in the UI

Out of scope:
- Bot chat/social behavior
- Bot relationship management decisions (use simple defaults)
- Sophisticated ML-based strategy (rule-based is fine)

</domain>

<decisions>
## Implementation Decisions

### Architecture
- **Bots are NOT WebSocket connections** — they are virtual players managed by the server
- Bot state lives in ServerState alongside real player state (same sessions, hands, playerSim maps)
- Bot sessions are marked with `isBot: true` flag on the Session type
- A new `bot-engine.ts` module contains all bot decision logic as pure functions (mirrors engine.ts pattern)
- The server calls bot-engine functions at the right moments (after state changes, during their turn)

### Bot Turn Execution
- After any state change that makes it a bot's turn, the server immediately executes the bot's action
- No artificial delay needed (can add later for feel) — bots act instantly
- Bot auction actions: server calls the same engine functions used for human players
- Bot card selection: `chooseBotCard(hand, game, personality)` → picks a card
- Bot bidding: `chooseBotBid(auction, game, personality, money)` → returns bid amount or pass

### Personality Profiles
- **Conservative**: bids low, prefers high-value established artists, sleeps often, avoids drugs
- **Aggressive**: bids high, chases trending artists, parties hard, takes risks
- **Erratic**: random weighting, unpredictable bids, chaotic slot choices — the wildcard

### Bot Names (wall-label style)
- Conservative: "Marta G.", "Henrik L."
- Aggressive: "Damien K.", "Yayoi M."  
- Erratic: "Banksy Jr.", "AI Warhol"

### Lobby Configuration
- Host sees a "BOTS" selector in the waiting room (0, 1, 2, 3)
- New message type: `SET_BOT_COUNT` sent by host
- Server creates bot sessions when game starts (not in lobby — they appear at game start)
- Bots count toward the 2-5 player limit

### Auction Bidding Strategy
- Open: bots bid incrementally based on perceived value ± personality noise
- Once Around: single bid based on hand value assessment
- Sealed Bid: similar to once around but with personality-scaled variance
- Fixed Price: accept/pass based on price vs perceived value
- Double: play second card if they have a matching artist, else pass

### Sim Day Strategy
- Bots auto-submit slots after a short delay (1-2 seconds)
- Slot selection weighted by personality: aggressive → parties/fairs, conservative → gallery work/sleep, erratic → random
- Travel decisions based on current neighborhood and personality preference

### Zod Validation
- `SET_BOT_COUNT` added to InboundMessage discriminated union
- Bot actions don't go through Zod (they're internal server calls, not WebSocket messages)

### Claude's Discretion
- Exact bid calculation formulas
- Perceived value heuristic for artists
- Noise/variance ranges per personality
- Bot slot submission delay timing

</decisions>

<canonical_refs>
## Canonical References

### Phase 1-3 Outputs (must respect)
- `src/lib/engine.ts` — all auction functions bots will call
- `src/lib/sim-engine.ts` — sim functions for bot slot resolution
- `src/lib/sim-config.ts` — slot types, neighborhoods, economy constants
- `party/server.ts` — server message handlers, phase machine, broadcastStateSecure
- `src/types/game.ts` — GameState, AuctionState, PlayerRecord, Session types

### Phase 2 Aesthetic
- `src/components/lobby/WaitingRoom.tsx` — add bot count selector here

</canonical_refs>

<deferred>
## Deferred Ideas

- Bot chat messages ("Interesting..." during auctions)
- Bot relationship strategy (just use defaults for now)
- Adaptive difficulty (bots that get smarter as the game progresses)

</deferred>

---

*Phase: 07-bot-players*
*Context gathered: 2026-04-09*

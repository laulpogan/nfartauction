# Architecture

**Analysis Date:** 2026-04-06

## Pattern Overview

**Overall:** Client-Server WebSocket with Authoritative Server

**Key Characteristics:**
- PartyKit WebSocket server holds all authoritative game state; clients are dumb displays
- All game logic runs in pure functional modules shared between client and server
- React frontend is stateless relative to game truth — it reflects server state received over the socket
- No REST API; all communication is bidirectional JSON messages over a persistent WebSocket connection
- State is persisted server-side in PartyKit Durable Object storage, enabling reconnects

## Layers

**Types Layer:**
- Purpose: Single source of truth for all data shapes and game constants
- Location: `src/types/game.ts`
- Contains: TypeScript interfaces (`GameState`, `AuctionState`, `Card`, `PlayerRecord`, `PublicPlayer`, `RoundResult`), union types for game status/auction status/artists, and game constants (`ARTISTS`, `ROUND_VALUES`, `HAND_DISTRIBUTION`, `ARTIST_COLORS`, `AUCTION_TYPE_NAMES`)
- Depends on: Nothing
- Used by: All other layers — server, engine, hooks, and components

**Game Engine Layer:**
- Purpose: Pure functional game rules with no side effects
- Location: `src/lib/engine.ts`, `src/lib/deck.ts`
- Contains: `playCard`, `playSecondCard`, `setFixedPrice`, `acceptFixedPrice`, `passFixedPrice`, `placeOpenBid`, `endOpenAuction`, `placeOnceAroundBid`, `submitSealedBid`, `endRound` in engine.ts; `buildDeck`, `shuffle`, `dealHands` in deck.ts
- Depends on: `src/types/game.ts` only
- Used by: `party/server.ts` (all game logic calls flow through here); also importable by client-side utilities

**Server Layer:**
- Purpose: Authoritative game state manager and message dispatcher
- Location: `party/server.ts`
- Contains: `GameServer` class implementing `Party.Server`; `ServerState` interface (holds `GameState` + private `hands` + `sessions` maps); message handler routing; persistence via `room.storage`
- Depends on: `src/types/game.ts`, `src/lib/engine.ts`, `src/lib/deck.ts`
- Used by: PartyKit runtime only

**WebSocket Hook Layer:**
- Purpose: Client-side socket lifecycle and message dispatch into React state
- Location: `src/hooks/useGame.ts`
- Contains: `useGame` hook managing `PartySocket` connection, deriving `isMyTurn`/`isAuctioneer`/`myMoney`, and exposing a typed `actions` object of send helpers
- Depends on: `partysocket`, `src/types/game.ts`
- Used by: `src/pages/GamePage.tsx`

**Page Layer:**
- Purpose: Route-level components that own connection state and branching between views
- Location: `src/pages/GamePage.tsx`, `src/components/lobby/Lobby.tsx`
- Contains: `GamePage` (conditionally renders `WaitingRoom` or `GameBoard` based on `game.status`); `Lobby` (create/join flow with local room code generation)
- Depends on: `useGame`, `GameBoard`, `WaitingRoom`, `react-router-dom`
- Used by: Router in `src/App.tsx`

**Component Layer:**
- Purpose: Presentational UI with no direct server access
- Location: `src/components/game/`, `src/components/lobby/`, `src/components/ui/`
- Contains: `GameBoard`, `AuctionPanel`, `PlayerHand`, `ArtCard`, `ArtistTracker`, `PlayerList`, `RoundEndModal`, `GameOverModal`, `WaitingRoom`, `Button`, `Modal`
- Depends on: `src/types/game.ts` for prop types; actions are passed down as callbacks
- Used by: Page layer

**Legacy Supabase Layer (unused):**
- Purpose: DB helpers from prior architecture, no longer called
- Location: `src/lib/supabase.ts`
- Contains: `getGame`, `getGameByCode`, `getPlayers`, `getMyPlayer`, `updateGame`, `updatePlayer`, `updateAllPlayers` — all direct Supabase queries
- Note: File exists but is not imported anywhere in the active codebase

## Data Flow

**Player Joins Game:**

1. `Lobby` generates a 4-character code or the user enters one, then navigates to `/game/:code?name=...`
2. `GamePage` mounts, calls `useGame(code, playerName)` which opens a `PartySocket` to `PARTYKIT_HOST` room `code`
3. On socket open, client sends `{ type: 'JOIN', name, isHost }` where `isHost` is read from `sessionStorage`
4. `GameServer.onMessage` creates or updates `ServerState`, calls `broadcastState()` → all clients receive `{ type: 'GAME_STATE', game }`
5. `useGame` sets `game` state; `GamePage` renders `WaitingRoom` (while `game.status === 'lobby'`)

**Auction Flow:**

1. Active player selects a card in `PlayerHand` and clicks "Start Auction"
2. `PlayerHand` calls `actions.playCard(card)` → `useGame` sends `{ type: 'PLAY_CARD', card }` over socket
3. `GameServer` calls `engine.playCard(game, playerRecord, card)` → returns updated game state
4. If round ends (5th painting of artist), server calls `engine.endRound()` and broadcasts `ROUND_END` result
5. Otherwise server persists and broadcasts updated `GameState`; clients re-render `AuctionPanel`
6. Players bid via `actions.placeOpenBid`, `actions.placeOnceAroundBid`, etc. → same message → server updates
7. Auction resolves in engine → server calls `broadcastState()` + `broadcastHands()` (since hands change)

**Private vs Public State:**

- `GameState` (public): broadcast to all clients, contains `PublicPlayer[]` (no hand)
- `hands`: server maps `sessionId → Card[]`, sends `{ type: 'YOUR_HAND', hand }` only to the owning connection
- `sessions`: server-only `SessionId → Session` map tracking money/paintings for engine use

**State Management:**
- Server state: held in `GameServer.state: ServerState`, persisted to PartyKit Durable Object storage on every mutation (`room.storage.put('state', this.state)`)
- Client state: React `useState` inside `useGame` hook — `game`, `hand`, `roundEndResult`, `connected`, `error`
- Session identity: UUID stored in `localStorage` under key `ma_session_id`; used as the `PartySocket` connection id, so reconnects get the same id and restore seamlessly

## Key Abstractions

**GameState:**
- Purpose: Complete public snapshot of the game at any point in time
- Examples: `src/types/game.ts` → `interface GameState`
- Pattern: Immutable value — engine functions take a `GameState` and return a new one; server replaces `this.state.game`

**PlayerRecord (private) vs PublicPlayer (public):**
- Purpose: `PlayerRecord` includes `hand: Card[]` and is only ever used server-side; `PublicPlayer` is what's in `GameState.players` and sent to clients
- Examples: `src/types/game.ts` → `interface PlayerRecord`, `interface PublicPlayer`
- Pattern: Server converts `Session + hand → PlayerRecord` on demand via `buildPlayerRecord()`, converts back to `PublicPlayer` via `makePublicPlayer()` for broadcast

**AuctionState:**
- Purpose: Full state of the current auction including all bid types' partial progress
- Examples: `src/types/game.ts` → `interface AuctionState`, `party/server.ts` and `src/lib/engine.ts`
- Pattern: `GameState.auction` is `null` when no auction is active; all auction type logic is unified into this single structure with type-specific fields

**Engine Functions:**
- Purpose: Stateless transformations — take game state in, return new game state out
- Examples: `src/lib/engine.ts` exports `playCard`, `endRound`, `resolveAuction` (private), etc.
- Pattern: All return `{ updatedGame, updatedPlayers?, result? }` tuples; never mutate arguments

## Entry Points

**Frontend Bootstrap:**
- Location: `src/main.tsx`
- Triggers: Browser loads `index.html`, Vite serves bundle
- Responsibilities: Mounts React app into `#root` with `StrictMode`

**Frontend Router:**
- Location: `src/App.tsx`
- Triggers: Render from `main.tsx`
- Responsibilities: Defines two routes: `/` → `Lobby`, `/game/:code` → `GamePage`

**PartyKit Server:**
- Location: `party/server.ts` (entry declared in `partykit.json`)
- Triggers: WebSocket connection from client; PartyKit runtime lifecycle hooks
- Responsibilities: `onStart` restores state from storage; `onConnect` sends current state to new connection; `onMessage` dispatches to action handlers

## Error Handling

**Strategy:** Server sends `{ type: 'ERROR', message }` to the offending connection on exceptions; client displays inline error text.

**Patterns:**
- Engine functions throw `Error` on invalid state (e.g., `'No active auction'`, `'Bid must exceed current bid'`)
- `GameServer.onMessage` wraps `handleMessage` in try/catch, sends ERROR message to sender
- `useGame` listens for `ERROR` messages and sets React `error` state
- `GamePage` renders a full-screen error view when `error` is set
- Socket errors (`close`, `error` events) set `connected = false` or `error = 'Connection error'`

## Cross-Cutting Concerns

**Logging:** None — no structured logging on server or client
**Validation:** Minimal — server checks host permissions and player count; engine throws on invalid moves; no input sanitization
**Authentication:** None — identity is a client-generated UUID in `localStorage`; `isHost` is a flag in `sessionStorage` set at room creation time, trusted by server without verification

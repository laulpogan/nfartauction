# Architecture Patterns

**Domain:** Multiplayer browser board game + gallery life sim hybrid
**Researched:** 2026-04-06
**Confidence:** HIGH (core patterns), MEDIUM (sim integration details)

---

## Recommended Architecture

The existing pattern — pure functional engine → authoritative PartyKit server → dumb React clients — is correct and must not be violated. The sim layer integrates as a parallel state domain inside the same server room, not as a separate service.

### Single-Room Architecture (Recommended)

Keep one PartyKit room per game session. The room holds two top-level state domains that share a single economy (money).

```
ServerState
├── game: GameState              ← existing auction engine state (public)
├── hands: Map<sessionId, Card[]> ← existing private hands
├── sim: SimState                ← NEW: shared sim world state (public)
├── playerSim: Map<sessionId, PlayerSimState> ← NEW: per-player private sim state
└── sessions: Map<sessionId, Session> ← existing session registry
```

Do NOT use a separate PartyKit room for sim state. Sim decisions affect auction outcomes (stat modifiers on bids) and auction outcomes affect sim state (money flows back). Cross-room communication in PartyKit requires HTTP fetch between Durable Objects — adding latency and complexity for state that is inherently co-located.

### Why Not Separate Rooms

A separate sim room would require:
- Cross-room fetch on every auction resolution to synchronize money
- Two WebSocket connections per client, doubling connection management complexity
- Ordering guarantees between rooms that PartyKit does not provide natively

The 128 MB RAM ceiling per room is not a concern for 2-4 players with the sim data volumes described in requirements.

---

## Component Boundaries

| Component | Location | Responsibility | Communicates With |
|-----------|----------|---------------|-------------------|
| Auction Engine | `src/lib/engine.ts` | Pure functional auction rules, state-in/state-out | Server only |
| Sim Engine | `src/lib/sim-engine.ts` | Pure functional sim rules: stat effects, slot resolution, relationship decay, drug inventory | Server only |
| Server | `party/server.ts` | Authoritative state holder; message dispatch; phase transitions; private state filtering | Clients via WebSocket |
| `useGame` hook | `src/hooks/useGame.ts` | WebSocket lifecycle; typed send helpers for auction actions | GamePage |
| `useSim` hook | `src/hooks/useSim.ts` | WebSocket message routing for sim state; local optimistic UI state | SimPage / SimPanel |
| GamePage | `src/pages/GamePage.tsx` | Phase-based view routing (sim day vs auction round vs results) | hooks, components |
| SimPanel | `src/components/sim/SimPanel.tsx` | Sim UI: time slots, neighborhood map, stat bars, drug inventory, landlord texts | useSim |
| AuctionPanel | `src/components/game/AuctionPanel.tsx` | Existing auction UI, unchanged | useGame |

---

## Phase Structure (Turn Sequence)

The game alternates between three phase types. The server owns the current phase and broadcasts it as part of `GameState.phase`.

```
LOBBY
  ↓
SIM_DAY (pre-auction)
  Players schedule time slots simultaneously (no turn order)
  Server resolves all slots when all players submit or timer expires
  Stats update: Money, Coolness, Restedness, Luck, Risk
  Neighborhood travel costs deducted
  Relationship scores decay
  Drug inventory visible only to owning player
  ↓
AUCTION_ROUND (rounds 1-4)
  Existing Modern Art engine, unchanged
  Stat modifiers from SIM_DAY applied to bid maximums / starting hands
  Round ends when 5th painting of any artist put up for auction
  End-of-round valuation runs; money distributed
  ↓
SIM_DAY (post-auction, inter-round)
  Repeat; neighborhoods shift Gentrification/Hotness
  ↓
GAME_OVER
  Appraisal document rendered; leaderboard as auction receipt
```

The phase field is a discriminated union on `GameState`:

```typescript
type GamePhase =
  | { type: 'lobby' }
  | { type: 'sim_day'; dayNumber: number; submittedPlayers: string[] }
  | { type: 'auction_round'; roundNumber: number }
  | { type: 'game_over' }
```

The server transitions phases. Clients never write `phase` directly.

---

## State Domains and Privacy Model

### Public State (broadcast to all clients)

`GameState` extended with sim fields:

```typescript
interface GameState {
  // existing fields unchanged
  phase: GamePhase
  players: PublicPlayer[]
  auction: AuctionState | null
  roundHistory: RoundResult[]
  deck: Card[]            // must be stripped before broadcast — existing bug

  // NEW sim additions (public)
  sim: SimState
}

interface SimState {
  artMarketHotness: number      // 0-100
  gentrificationLevel: number   // 0-100 per neighborhood
  nftHypeCycle: number          // 0-100, unlocks NFT economy when high
  neighborhoods: Neighborhood[] // name, accent, current events
  dayNumber: number
}
```

`PublicPlayer` extended with public sim stats:

```typescript
interface PublicPlayer {
  // existing fields
  name: string
  money: number
  paintings: Record<Artist, number>

  // NEW public sim stats (opponents can see these)
  coolness: number
  prestige: number        // derived from auction wins, drives landlord leverage
  // Restedness and Luck are private — they create bidding uncertainty
}
```

### Private State (per-player, sent only to owner)

Server sends `{ type: 'YOUR_SIM_STATE', simState: PlayerSimState }` to the owning connection only — same pattern as `YOUR_HAND`.

```typescript
interface PlayerSimState {
  restedness: number          // hidden: affects auction decision UI hints
  luck: number                // hidden: affects random event outcomes
  risk: number                // hidden: derived from drug inventory
  drugInventory: DrugItem[]   // private: quantity, type, passive Risk accumulation
  relationships: Relationship[] // private: named artists/collectors, decay timer
  faction: FactionAlignment   // private until visible threshold crossed
  nftWallet: number           // private: parallel economy balance (unlocked at Coolness threshold)
  scheduledSlots: TimeSlot[]  // private during scheduling phase, resolved server-side
}
```

### KV Storage Strategy

PartyKit's KV storage is key/value with 128 KiB per value limit. Store as two keys:

```
"state"         → entire ServerState (game + sim + sessions, minus playerSim)
"playersim"     → Map<sessionId, PlayerSimState>
```

Load both in `onStart`. Persist both on every sim mutation. The existing pattern of `room.storage.put('state', this.state)` extends naturally by adding a second `room.storage.put('playersim', this.playerSim)`.

If `ServerState` grows too large (unlikely for 2-4 players but possible with full roundHistory), shard:
- `"game"` → `GameState`
- `"sim"` → `SimState`
- `"sessions"` → session map
- `"playersim"` → per-player private sim

---

## Sim Engine Design

The sim engine follows the same pure functional pattern as the auction engine.

```typescript
// src/lib/sim-engine.ts

// Resolve a player's scheduled time slots → return updated PlayerSimState + events
function resolveSlots(
  playerSim: PlayerSimState,
  slots: TimeSlot[],
  publicSim: SimState,
  player: PublicPlayer
): { updatedPlayerSim: PlayerSimState; events: SimEvent[] }

// Apply inter-round decay (relationships, NFT hype drift, neighborhood shifts)
function advanceDay(
  sim: SimState,
  allPlayerSims: PlayerSimState[]
): { updatedSim: SimState; updatedPlayerSims: PlayerSimState[] }

// Apply stat modifiers from sim state to auction engine inputs
function applySimModifiers(
  player: PublicPlayer,
  playerSim: PlayerSimState,
  sim: SimState
): AuctionModifiers   // { bidCeiling?, handDrawBonus?, luckyBreak? }
```

All functions: take state in, return new state out. No side effects. Testable in isolation.

---

## NFT Parallel Economy Integration

The NFT layer is a satirical in-game system, not blockchain. It is a stat-gated overlay on the existing economy.

Design principle: the NFT layer is the same UI, slightly broken.

### Unlock Condition

When `player.coolness >= NFT_COOLNESS_THRESHOLD` (suggested: 60), the server sets `playerSim.nftWalletUnlocked = true` and sends a `YOUR_SIM_STATE` update. The client reveals the NFT panel without a page reload.

### Economy Separation

NFT economy runs as a parallel ledger inside `PlayerSimState.nftWallet`. It is intentionally volatile.

```typescript
interface NftEconomy {
  nftWallet: number            // "eth" balance, stored as integer microunits
  exchangeRate: number         // eth-to-game-money rate, shifts per sim day
  heldNfts: NftItem[]         // purchased at parties/fairs, sellable at fluctuating rates
}
```

The NFT exchange rate is a function of `SimState.nftHypeCycle`. The hype cycle drifts randomly each sim day, capped at 0-200 (percentage of base rate). This means NFT profits can exceed or collapse against real money.

### No Cross-Contamination Rule

NFT money does NOT flow directly into the auction money pool. A player must explicitly convert at the current exchange rate via a `CONVERT_NFT` message. The server validates the conversion, deducts `nftWallet`, adds to `player.money`, and broadcasts. This keeps the core auction economy clean.

### Why This Works Architecturally

The NFT layer is entirely within `PlayerSimState` (private) and `SimState.nftHypeCycle` (public). It touches the main economy only through the explicit `CONVERT_NFT` action, which the existing money-handling path can accommodate without refactoring.

---

## Client-Side State Management

### Pattern: Server as Source of Truth, Local State for Interactivity

The existing `useGame` hook holds `game` state received from server. Extend this to a `useSim` hook holding `sim` and `playerSim` received from server.

Between WebSocket updates (during the sim day scheduling phase), the client needs local draft state for slot selection. This local draft state is NOT server truth — it is a staging area before the player submits.

```typescript
// useSim.ts internal state shape
const [sim, setSim] = useState<SimState | null>(null)        // from server
const [playerSim, setPlayerSim] = useState<PlayerSimState | null>(null)  // from server
const [draftSlots, setDraftSlots] = useState<TimeSlot[]>([]) // local staging
```

`draftSlots` is purely local. The player arranges their day, then clicks "Submit Day". The `SUBMIT_SLOTS` message goes to server, server resolves, returns `YOUR_SIM_STATE` update. Client clears `draftSlots` on receipt.

### No Global State Library Needed

The existing pattern of `useState` inside hooks is sufficient. Zustand was listed as a dependency and removed as dead code — do not reintroduce it. The data flow is unidirectional:

```
Server WebSocket message → hook setState → React re-render
User action → hook sends message → Server processes → broadcast → hook setState
```

This is already the correct pattern. The sim layer follows it without modification.

### Optimistic UI (Sim Day Only)

For the sim day scheduling (not for auction), apply local optimistic updates: show slot as "scheduled" immediately on click, revert if server sends an error. This is the one place where `draftSlots` state diverges from server truth. Keep it scoped to the slot picker component, not the global hook.

---

## Data Flow: Sim Day Resolution

```
All players arrange draftSlots locally
  ↓
Each player sends SUBMIT_SLOTS { slots: TimeSlot[] }
  ↓
Server marks player as submitted in phase.submittedPlayers[]
Server broadcasts updated GameState (shows who has submitted)
  ↓
When all players submitted (or timeout):
  Server calls sim-engine.resolveSlots() for each player
  Server calls sim-engine.advanceDay() for global sim state
  Server updates sim + all playerSim records
  Server persists to KV
  Server broadcasts new GameState (updated sim, updated PublicPlayer stats)
  Server sends YOUR_SIM_STATE to each connection individually
  Server transitions phase → auction_round or game_over
  ↓
Each client receives:
  { type: 'GAME_STATE', game }    → updates sim + public player stats
  { type: 'YOUR_SIM_STATE', ... } → updates private stats, drug inventory, relationships
```

---

## Data Flow: Auction → Sim Transition

```
Auction round ends (engine.endRound())
  ↓
Server distributes round valuations to player.money
Server broadcasts ROUND_END result (existing)
Server transitions phase → sim_day (new dayNumber)
Server broadcasts updated GameState with new phase
  ↓
Client GamePage reads game.phase
Renders SimPanel instead of AuctionPanel
Players begin slot scheduling
```

The `GamePage` phase switch is a conditional render on `game.phase.type`:

```typescript
switch (game.phase.type) {
  case 'lobby':      return <WaitingRoom />
  case 'sim_day':    return <SimPanel />
  case 'auction_round': return <GameBoard />
  case 'game_over':  return <AppraisalScreen />
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Authoritative Sim State

Any sim resolution that affects money, stats, or relationship scores must happen on the server. The client proposes (sends slot choices), the server resolves. Never trust client-reported stat values.

Consequences if violated: players can exploit stat buffs, drug effects, or money conversions to cheat.

### Anti-Pattern 2: Separate Sim Room Per Player

Do not create one PartyKit room per player for their private sim state. Private state is handled by sending targeted `YOUR_SIM_STATE` messages over the shared room connection, same as the existing `YOUR_HAND` pattern. Per-player rooms would require cross-room messaging for any action that touches shared state (global sim, money).

### Anti-Pattern 3: Polling for Sim State

Do not poll the server from the client for sim updates. The WebSocket connection is already open. Push updates server → client on every sim mutation, same as auction state. Polling adds latency and is architecturally inconsistent with the existing pattern.

### Anti-Pattern 4: Merging Sim Engine into Auction Engine

Keep `sim-engine.ts` separate from `engine.ts`. The auction engine is pure Knizia rules — it should remain independently testable and auditable. Sim rules go in a separate module. The server orchestrates calling both.

### Anti-Pattern 5: Blocking Auction Start on Sim Complexity

The sim day should have a hard timeout (suggested: 60 seconds). If a player has not submitted slots when the timer fires, the server resolves their day with whatever draft slots exist, or with a default "sleep" slot. The auction round must not be gated indefinitely on one player.

---

## Scalability Considerations

| Concern | At 2-4 players (target) | At 10 players (ceiling) | Notes |
|---------|------------------------|-------------------------|-------|
| State size | Trivially small | Still fine (<128 KiB) | PlayerSimState per player is ~2 KB |
| Broadcast volume | Full state on every action | Full state on every action | Acceptable for 4 players; would need diffing at 10+ |
| Private message volume | 1 YOUR_HAND + 1 YOUR_SIM_STATE per transition | Linear growth | Still negligible |
| KV writes | 2 keys per sim resolution | 2 keys per sim resolution | KV is not the bottleneck |
| Sim day timeout | Fixed 60s | Fixed 60s | No scaling concern |

---

## Suggested Build Order

Build the sim layer in this dependency order to avoid architectural thrash:

1. **Types extension** — Extend `GameState`, `PublicPlayer`, add `SimState`, `PlayerSimState`, `GamePhase`, message types. No logic yet. Types are the contract everything depends on.

2. **Sim engine module** — `src/lib/sim-engine.ts`. Pure functions, fully testable before any server or UI work. Write tests alongside.

3. **Server phase machine** — Extend `party/server.ts` with phase transition logic, `SUBMIT_SLOTS` handler, slot resolution dispatch, `YOUR_SIM_STATE` dispatch. Extend KV persistence to include `playerSim`.

4. **`useSim` hook** — Client-side WebSocket message routing for sim messages. Mirror the structure of `useGame`.

5. **SimPanel component tree** — Slot picker, neighborhood map, stat display, landlord text arc. Render from hook state.

6. **Phase routing in GamePage** — Switch on `game.phase.type` to route between SimPanel and GameBoard.

7. **NFT layer** — Gated behind Coolness threshold. Add after core sim loop is stable. Purely additive.

8. **Aesthetic system** — Wall-label typography, neighborhood accent colors, receipt renders. Intentionally last in the UI build; should be layered over functional components without structural refactoring (if component boundaries are kept clean from step 5).

Note: Steps 1-3 (engine hardening, tests, security fixes documented in CONCERNS.md) must precede step 2 of sim work. Building sim on top of an untested auction engine is a force multiplier for bugs.

---

## Sources

- PartyKit storage patterns: https://docs.partykit.io/guides/persisting-state-into-storage/
- PartyKit room isolation model: https://docs.partykit.io/how-partykit-works/
- Cloudflare Durable Objects storage best practices: https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/
- React state management for WebSocket games (Zustand vs local state): https://makersden.io/blog/react-state-management-in-2025
- Turn-based multiplayer server authority patterns: https://longwelwind.net/blog/networking-turn-based-game/
- Scalable WebSocket game architecture: https://blog.hathora.dev/scalable-websocket-architecture/

# Phase 3: Core Sim Loop - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Source:** Extracted from PROJECT.md brief + research SUMMARY.md ARCHITECTURE.md

<domain>
## Phase Boundary

This phase establishes the architectural backbone of the gallery sim layer: the alternating `sim_day` ↔ `auction_round` phase machine, the per-player private sim state pattern, and the time-slot scheduling loop. All subsequent sim features (Phase 4 sim depth, Phase 5 NFT layer + end state) build additively on this foundation.

In scope:
- `sim_day` and `auction_round` phase machine in PartyKit server
- `SimState` (public, broadcast) and `PlayerSimState` (private, per-connection)
- New pure functional `sim-engine.ts` module mirroring the engine.ts pattern
- Player stats: Money, Coolness, Restedness, Luck
- Global stats: Art Market Hotness, Gentrification Level, NFT Hype Cycle
- Time slot scheduling with 6 slot types (gallery work, studio visits, art fair, opening, party, sleep)
- Five neighborhoods on a navigable map with travel cost
- 60-second hard timeout for sim day phase
- `useSim` hook mirroring `useGame`
- `SimPanel` UI component (consumes Phase 2 aesthetic primitives)
- Zustand stores: `useSimSessionStore` (ephemeral) + `useSimPlayerStore` (localStorage-persisted)
- Economy constants config object + dev-mode transaction log
- Visually unified money: sim money = auction money

Out of scope (Phase 4):
- Relationship system mechanics (just type stub for now)
- Drug system mechanics (just type stub)
- Landlord system (just type stub)
- Faction stat modifiers
- The Artist You Shouldn't Have Dropped

</domain>

<decisions>
## Implementation Decisions

### Architecture (locked from research SUMMARY.md)
- **Same PartyKit room** holds both auction and sim state — NOT separate rooms
- **Server is authoritative** for sim state, same as auction state
- **GameState gets a `phase` discriminated union**: `{type: 'lobby'} | {type: 'sim_day', day: number} | {type: 'auction_round', round: number} | {type: 'game_over'}`
- **Phase machine flow**: lobby → sim_day(1) → auction_round(1) → sim_day(2) → auction_round(2) → ... → game_over
- **Sim state split**: `SimState` in `GameState` (public, broadcast to all); `Map<sessionId, PlayerSimState>` server-side, sent only to owning connection via new `YOUR_SIM_STATE` message
- **derivePublicState extension**: continue stripping deck and sealedBids; sim state additions are public-by-default but private parts go via the per-connection channel

### Stat System
- Personal stats: `Money`, `Coolness`, `Restedness`, `Luck` (numbers 0-100 for non-money; money is unbounded)
- Global stats: `artMarketHotness` (0.5-2.0 multiplier), `gentrificationLevel` (1-10 integer), `nftHypeCycle` (0-100, volatile)
- Stats live in `PlayerSimState` (personal) and `SimState` (global)

### Time Slot System
- 6 slot types: `gallery_work`, `studio_visits`, `art_fair`, `opening`, `party`, `sleep`
- Players cannot fill all slots — by design
- Each slot has a `time_of_day` and a target neighborhood (or null for slots in current location)
- Travel between neighborhoods consumes one slot
- Server-side timeout: 60 seconds; auto-advance with whatever was submitted (or empty if nothing)

### Neighborhood Map
- Five neighborhoods (matches Phase 2 accent system): `gallery`, `warehouse`, `flatlands`, `hotel`, `online`
- Player has `currentNeighborhood` in PlayerSimState
- Online is special: accessible without travel slot (no Restedness cost)

### Phase 2 Reuse
- All sim UI uses `<WallLabel>`, `<Receipt>`, `<AppraisalForm>` from Phase 2
- Stats display as appraisal form (Money, Coolness, Restedness, Luck)
- Sim day result renders as a receipt
- Neighborhood transitions use `NeighborhoodProvider` to flow accent color

### Stack Decisions
- **Zustand 5** (already installed) — activate two stores:
  - `useSimSessionStore` — ephemeral, draftSlots staging, current view
  - `useSimPlayerStore` — localStorage-persisted, scoped to room+player UUID
- **Zod 4** — extend the InboundMessage discriminated union from Phase 1 with sim message types
- **Vitest 4** — sim-engine.ts tests follow the engine.ts test pattern

### Economy Constants Config
- Single config object `src/lib/sim-config.ts` with all named constants
- Dev-mode transaction log: when `import.meta.env.DEV`, log every stat change to console with full context
- Hard-coded linear costs as placeholders — DO NOT attempt mathematical balancing in code

### Privacy Model (mirrors hand privacy from Phase 1)
- `PlayerSimState` (drug inventory placeholder, relationship stubs, faction alignment) is private
- Server sends `YOUR_SIM_STATE` to each connection on connect, on phase transition, and on stat change
- Public sim view (other players' stats) shows aggregated/visible info only

### Claude's Discretion
- Specific economic constants (placeholder values to be tuned in playtesting)
- Exact slot count per day (3-5 reasonable)
- Initial stat values for new players
- Component layout details for SimPanel
- Phase transition animation choreography

</decisions>

<canonical_refs>
## Canonical References

### Project Specs
- `.planning/PROJECT.md` — Sim requirements (SIM-01 through SIM-10)
- `.planning/REQUIREMENTS.md` — SIM-01 through SIM-10 detailed
- `.planning/research/SUMMARY.md` — Stack and architecture decisions
- `.planning/research/ARCHITECTURE.md` — Full sim integration pattern

### Phase 1 Outputs (must respect)
- `.planning/phases/01-engine-hardening-security/01-01-SUMMARY.md` — derivePublicState pattern, public state projection
- `.planning/phases/01-engine-hardening-security/01-02-SUMMARY.md` — Zod InboundMessage discriminated union (extend, don't replace)
- `src/lib/engine.ts` — pure functional engine pattern to mirror
- `party/server.ts` — derivePublicState, broadcastStateSecure, message handler structure

### Phase 2 Outputs (must consume)
- `.planning/phases/02-aesthetic-system-foundation/02-02-SUMMARY.md` — primitive components
- `src/components/aesthetic/WallLabel.tsx`
- `src/components/aesthetic/Receipt.tsx`
- `src/components/aesthetic/AppraisalForm.tsx`
- `src/contexts/NeighborhoodContext.tsx` — neighborhood accent flow
- `src/styles/tokens.css` — design tokens

### Existing Codebase
- `src/types/game.ts` — extend with sim types
- `src/hooks/useGame.ts` — pattern to mirror for useSim
- `src/pages/GamePage.tsx` — phase routing (sim_day vs auction_round)

</canonical_refs>

<specifics>
## Specific Ideas

- Slot scheduling UI: a grid of slot pickers, each slot is a wall label dropdown
- Day result receipt: shows what each slot resolved to + stat changes
- Phase transition: simple wall-label "DAY 2 BEGINS" / "AUCTION ROUND 2" interstitial
- Neighborhood navigator: a wall-label list with the 5 neighborhoods, accent color of selected lights up
- Money display: same format/component used for auction money — single source of truth

</specifics>

<deferred>
## Deferred Ideas

- Relationship character UI (Phase 4)
- Drug inventory display (Phase 4)
- Landlord text messages (Phase 4)
- NFT panel (Phase 5)
- End-state appraisal document (Phase 5)
- Character avatars / portraits

</deferred>

---

*Phase: 03-core-sim-loop*
*Context gathered: 2026-04-06*

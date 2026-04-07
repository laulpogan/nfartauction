# Roadmap: NFArt Auction

## Overview

The build sequence follows dependency order: fix and harden the existing auction engine before touching the sim, establish the visual system before building any sim UI, construct the core sim loop before adding depth mechanics, then layer in the NFT economy and end state once the base loop is stable. Deployment comes last, after the full feature set is solid. Every phase delivers a coherent, independently verifiable capability; no phase delivers a horizontal layer that leaves nothing playable.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Engine Hardening & Security** - Fix four live security bugs, consolidate logic, remove dead code, and ship a tested auction engine (completed 2026-04-07)
- [ ] **Phase 2: Aesthetic System Foundation** - Establish the zine visual language, wall-label typography, receipt components, and all five auction type skins
- [ ] **Phase 3: Core Sim Loop** - Build the sim_day phase, time slot scheduling, stats, shared economy, and the server phase machine
- [ ] **Phase 4: Sim Depth — Relationships, Landlord, Drugs** - Add named character relationships with decay, the landlord text arc, and the drug inventory system
- [ ] **Phase 5: NFT Layer & End State** - Unlock the parallel NFT economy at the Coolness threshold and render the game's end state as an appraisal document
- [ ] **Phase 6: Deployment & Polish** - Clean the repo, configure Cloudflare Pages, deploy to a public URL

## Phase Details

### Phase 1: Engine Hardening & Security
**Goal**: The auction engine is trustworthy, tested, and clean — no security bugs, no dead code, no logic duplication
**Depends on**: Nothing (first phase)
**Requirements**: ENG-01, ENG-02, ENG-03, ENG-04, ENG-05, ENG-06, ENG-07, ENG-08, ENG-09, ENG-10
**Success Criteria** (what must be TRUE):
  1. A player in a sealed-bid auction cannot read other players' bid amounts from the WebSocket frame before the reveal phase
  2. A player cannot see the remaining deck by inspecting the broadcast GameState payload
  3. A non-auctioneer player's attempt to play the second card in a double auction is rejected by the server
  4. Submitting a malformed or out-of-range WebSocket message is rejected before it reaches any engine function
  5. The engine test suite runs green, covering all five auction types, cumulative valuation across rounds, round-end trigger, and sealed-bid tie-breaking
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Security fixes: derivePublicState, deck strip, host assignment, double-auction faithful rules, reconnect round summary
- [x] 01-02-PLAN.md — Input validation (Zod 4), startGame consolidation, Supabase/dead code removal, sealed bid tie-breaking fix
- [x] 01-03-PLAN.md — Engine tests (Vitest 4): all five auction types, round-end trigger, tie-breaking, cumulative valuation, pass cycle

### Phase 2: Aesthetic System Foundation
**Goal**: A complete visual language is in place — every existing and future UI component has the correct zine aesthetic, wall-label typography, and neighborhood accent by default
**Depends on**: Phase 1
**Requirements**: AEST-01, AEST-02, AEST-03, AEST-04, AEST-05, AEST-06, AEST-07, AEST-08, AEST-09, AEST-10, AEST-11
**Success Criteria** (what must be TRUE):
  1. Every screen uses white base, black type, and the single accent color for the active neighborhood context — no default Tailwind blues or grays survive
  2. Switching the neighborhood context visibly changes the accent color across all in-context elements
  3. Auction results render as a printed receipt, not a modal or result card
  4. All five auction types display distinct visual skins — a player can identify the auction type from the room aesthetic alone
  5. The Online neighborhood UI shows the flickering accent and incorrect font loading as a deliberate design state
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Wave 0 atomic palette swap: @theme tokens, NeighborhoodContext, jsdom test infra, dark→white rewrite of all 5 game components (AEST-01, AEST-02)
- [x] 02-02-PLAN.md — Three aesthetic primitives (WallLabel, Receipt, AppraisalForm) + replace round-end + game-over modals with Receipt + thread WallLabel into GameBoard header (AEST-03, AEST-04, AEST-05)
- [x] 02-03-PLAN.md — Five auction visual skins dispatched from AuctionPanel + OnlineNeighborhood broken-font wrapper (AEST-06 through AEST-11)
**UI hint**: yes

### Phase 3: Core Sim Loop
**Goal**: The game alternates between sim_day and auction_round phases; players schedule time slots, submit them, and their stats and money update before the next auction
**Depends on**: Phase 2
**Requirements**: SIM-01, SIM-02, SIM-03, SIM-04, SIM-05, SIM-06, SIM-07, SIM-08, SIM-09, SIM-10
**Success Criteria** (what must be TRUE):
  1. After an auction round ends, all players see a sim_day phase where they can allocate time slots from the six available types across five neighborhoods
  2. A player's Money, Coolness, Restedness, and Luck stats update visibly between the sim day and the next auction round
  3. Sim money and auction money display as the same number in every context — there is no separate wallet or separate display
  4. If a player has not submitted their slots after 60 seconds, the server auto-advances the sim phase for all players
  5. Each player's sim state (stats, inventory) is visible to that player only — inspecting another player's WebSocket frame reveals nothing private
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md — Type layer + sim-engine pure functional core (GamePhase, SimState, PlayerSimState, sim-config constants, resolveSlots/advanceDay/applySimModifiers + tests)
- [x] 03-02-PLAN.md — Server phase machine, SUBMIT_SLOTS Zod handler, per-connection YOUR_SIM_STATE, 60-second hard timeout
- [x] 03-03-PLAN.md — useGame YOUR_SIM_STATE wiring, useSim hook, Zustand 5 reactivation as ephemeral session + persisted player stores
- [x] 03-04-PLAN.md — SimPanel UI tree (StatDisplay, SlotPicker, NeighborhoodMap, GlobalStatsBar, DayResultReceipt) + GamePage phase routing
**UI hint**: yes

### Phase 4: Sim Depth — Relationships, Landlord, Drugs
**Goal**: Named characters have relationships that decay and affect bidding; the landlord escalates through five text-message stages; drugs are inventoried alongside paintings
**Depends on**: Phase 3
**Requirements**: DEPTH-01, DEPTH-02, DEPTH-03, DEPTH-04, DEPTH-05, DEPTH-06, DEPTH-07, DEPTH-08, DEPTH-09, DEPTH-10
**Success Criteria** (what must be TRUE):
  1. A relationship score visibly changes between rounds, and a "cold" warning state is displayed before the score reaches zero
  2. Named characters with high relationship scores bid more aggressively in auctions; players can observe the modifier in practice
  3. The landlord sends a text message at each of the five escalation stages, gated by gallery Prestige — all five stages are reachable in a full game
  4. Drug inventory appears on the same appraisal form as the painting collection, in the same wall-label format
  5. Carrying drugs above the inventory threshold shows a passive Risk stat accumulating on the player's appraisal form
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md — Relationship system: Relationship[] in PlayerSimState, exponential decay, cold-state chip, bid-likelihood modifier, dropped-artist seed, faction derivation, RelationshipPanel UI (DEPTH-01, 02, 03, 09, 10)
- [x] 04-02-PLAN.md — Landlord arc: 5-stage prestige-gated progression, authored stage messages, LandlordMessages iMessage-style UI in SimPanel (DEPTH-04, 05)
- [x] 04-03-PLAN.md — Drug system: DrugItem[] inventory, server-rolled acquisition at flatlands/hotel, party-slot use, accumulateRisk, DrugInventory UI as AppraisalForm, RISK row on StatDisplay (DEPTH-06, 07, 08)
**UI hint**: yes

### Phase 5: NFT Layer & End State
**Goal**: Players who cross the Coolness threshold unlock a parallel NFT economy; the game ends with a printed appraisal document and an auction-receipt leaderboard
**Depends on**: Phase 4
**Requirements**: NFT-01, NFT-02, NFT-03, NFT-04, NFT-05, END-01, END-02, END-03
**Success Criteria** (what must be TRUE):
  1. A player whose Coolness crosses the configured threshold receives an in-game DM and sees the NFT panel appear without a page reload
  2. The NFT wallet balance and exchange rate are visibly separate from main money — converting requires an explicit player action
  3. NFT activity generates faction notifications in wall-label format visible to the relevant players
  4. After round four, every player sees a printed appraisal document summarizing their gallery legacy — faction mix, neighborhoods visited, NFT exposure, relationship outcomes
  5. The leaderboard renders as an auction receipt, not a table — the winning player is declared in receipt format
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md — NFT layer: Coolness threshold unlock, nftWallet/heldNfts state, CONVERT_NFT + PURCHASE_NFT_WHITELIST handlers, faction reactions, NftPanel UI in OnlineNeighborhood wrapper
- [ ] 05-02-PLAN.md — End state: round-4 game_over transition, computeFinalAppraisal pure function, APPRAISAL_TEMPLATES, EndStateAppraisal component replacing GameOverModal body, receipt-format leaderboard
**UI hint**: yes

### Phase 6: Deployment & Polish
**Goal**: The game is live at a public URL with no Supabase credentials, no artifact directories, and a clean production configuration
**Depends on**: Phase 5
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03
**Success Criteria** (what must be TRUE):
  1. A fresh clone of the repo can deploy to production without setting any Supabase environment variables
  2. The game is reachable at a public URL — a player can share the link, enter a room code, and start a game
  3. The `app/` subdirectory does not exist in the production repository — the root is the only canonical source
**Plans**: TBD

Plans:
- [ ] 06-01: Repo cleanup — delete app/ artifact, verify partykit version pin, remove Supabase env vars
- [ ] 06-02: Cloudflare Pages config — VITE_PARTYKIT_HOST, _redirects for SPA routing, partykit deploy verification

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Engine Hardening & Security | 3/3 | Complete   | 2026-04-07 |
| 2. Aesthetic System Foundation | 0/3 | Not started | - |
| 3. Core Sim Loop | 0/4 | Not started | - |
| 4. Sim Depth — Relationships, Landlord, Drugs | 0/4 | Not started | - |
| 5. NFT Layer & End State | 0/3 | Not started | - |
| 6. Deployment & Polish | 0/2 | Not started | - |

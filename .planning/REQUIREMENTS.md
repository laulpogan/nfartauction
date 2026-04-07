# Requirements: NFArt Auction

**Defined:** 2026-04-06
**Core Value:** Friends can complete a full 4-round Modern Art auction game online, with gallery sim decisions shaping who they are when they sit down to bid.

## v1 Requirements

### Engine — Hardening & Security

- [ ] **ENG-01**: Sealed bid amounts are hidden from all players until the reveal phase (not exposed in WebSocket broadcast)
- [ ] **ENG-02**: Deck cards are excluded from public GameState broadcast (server-only; clients only see their own hand)
- [ ] **ENG-03**: Only the auctioneer player can play the second card in a double auction
- [ ] **ENG-04**: Host status is assigned server-side by connection order (not trusted from client JOIN message)
- [ ] **ENG-05**: All inbound WebSocket messages are validated by Zod schemas before reaching engine functions
- [ ] **ENG-06**: `startGame` logic lives in the engine function, not duplicated inline in the server
- [ ] **ENG-07**: Dead Supabase module (`src/lib/supabase.ts`), orphaned SQL files, and unused `zustand` dependency are removed
- [ ] **ENG-08**: Round-end trigger fires when the 5th painting of any artist is put up for auction (not after auction resolves)
- [ ] **ENG-09**: A reconnecting player receives the last round summary state (not lost on WebSocket reconnect)
- [ ] **ENG-10**: Engine has unit tests covering all five auction types, cumulative valuation, round-end trigger, and sealed-bid tie-breaking

### Aesthetic System

- [ ] **AEST-01**: All UI uses the zine visual language: white base, black type, single accent color per neighborhood context
- [ ] **AEST-02**: Five neighborhood accent colors are applied as a design token system (Gallery District blue, Warehouse amber, Flatlands red, Hotel beige, Online flickering)
- [ ] **AEST-03**: Wall-label typography component renders all game copy — auction results, stat displays, drug inventory — in the same format as gallery labels
- [ ] **AEST-04**: Auction results render as a printed receipt (not a generic result card)
- [ ] **AEST-05**: Player stats display as an appraisal form (not a HUD or dashboard)
- [ ] **AEST-06**: Open auction visual skin: preview night aesthetic with character indicators and raised-hand feedback
- [ ] **AEST-07**: Once Around auction visual skin: formal dinner aesthetic, players shown in seat order, bids spoken in sequence
- [ ] **AEST-08**: Sealed bid visual skin: everyone-on-phones aesthetic with a simultaneous reveal animation
- [ ] **AEST-09**: Fixed price auction visual skin: price tag on white wall with gallery assistant presence indicator
- [ ] **AEST-10**: Double auction visual skin: drop format, dark background, countdown timer
- [ ] **AEST-11**: Online neighborhood UI renders with intentionally incorrect font loading and flickering accent color

### Gallery Sim — Core Loop

- [ ] **SIM-01**: Game alternates between `sim_day` and `auction_round` phases, server-authoritative
- [ ] **SIM-02**: Player tracks four personal stats: Money, Coolness, Restedness, Luck
- [ ] **SIM-03**: Three global stats fluctuate by round: Art Market Hotness (auction valuation multiplier), Gentrification Level (rent/travel costs), NFT Hype Cycle (exchange rate)
- [ ] **SIM-04**: Player allocates a finite set of daily time slots (cannot fill them all in one day)
- [ ] **SIM-05**: All six slot types are available: gallery work, studio visits, art fair, opening/event, party, sleep
- [ ] **SIM-06**: Five neighborhoods exist on the map; traveling between zones costs a time slot
- [ ] **SIM-07**: Sim money and auction money are the same number, visually unified in all displays
- [ ] **SIM-08**: Slot costs and economy constants are exposed as named config constants (no magic numbers), with a dev-mode transaction log for playtesting
- [ ] **SIM-09**: Per-player sim state (stats, inventory, relationships) is private (sent only to the owning player, mirroring the existing hand privacy pattern)
- [ ] **SIM-10**: A 60-second hard timeout advances the sim phase if not all players have submitted their slots

### Sim Depth — Relationships, Landlord, Drugs

- [ ] **DEPTH-01**: Named artist and collector characters exist with a relationship score that decays exponentially each round without contact
- [ ] **DEPTH-02**: Relationship score affects a named character's bid likelihood in auctions (±10–15% modifier)
- [ ] **DEPTH-03**: A "cold" relationship state is visually indicated before the score hits zero (warning before loss)
- [ ] **DEPTH-04**: The landlord communicates via text messages in wall-label font, progressing through 5 escalation stages
- [ ] **DEPTH-05**: Landlord stage progression is gated by gallery Prestige (show history, press coverage, collector visit count)
- [ ] **DEPTH-06**: Drug inventory is tracked per player and renders on the same appraisal form as the painting collection
- [ ] **DEPTH-07**: Drug use at parties and art fairs applies a Coolness modifier and Restedness cost
- [ ] **DEPTH-08**: Carrying drugs above inventory threshold accumulates a passive Risk stat
- [ ] **DEPTH-09**: Faction alignment is tracked in player sim state and applies basic stat modifiers (stubs, not full narrative depth)
- [ ] **DEPTH-10**: The "Artist You Shouldn't Have Dropped" generates a passive Credibility penalty scaled to that artist's current market value, visible to the player

### NFT Layer

- [ ] **NFT-01**: NFT panel unlocks when a player's Coolness crosses a configurable threshold (delivered as an in-game DM from a named character)
- [ ] **NFT-02**: NFT economy runs as a parallel wallet (`nftWallet`) separate from the main money pool
- [ ] **NFT-03**: Exchange rate between NFT wallet and main money fluctuates per sim day, tracked by the NFT Hype Cycle global stat
- [ ] **NFT-04**: Player can explicitly convert NFT wallet value to main money (no automatic flow between economies)
- [ ] **NFT-05**: NFT activity generates faction reactions: Sculptors receive an outraged notification; Social/Political artists generate a public denouncement notification in wall-label format

### End State

- [ ] **END-01**: Game ends after four rounds; highest money total wins
- [ ] **END-02**: End state renders as a printed appraisal document summarizing the player's gallery legacy (faction mix, neighborhood history, NFT exposure, relationship outcomes)
- [ ] **END-03**: Leaderboard renders as an auction result receipt (not a conventional score table)

### Deployment

- [ ] **DEPLOY-01**: `app/` subdirectory artifact is deleted before deployment (root is canonical source)
- [ ] **DEPLOY-02**: Game deploys to a public URL: PartyKit production server + static frontend host (Cloudflare Pages)
- [ ] **DEPLOY-03**: Production deployment requires no Supabase credentials

## v2 Requirements

### Social & Press Layer

- **PRESS-01**: Named critics with faction alignment generate procedural art criticism reviews (positive/negative with stat effects)
- **PRESS-02**: Instagram feed layer tracks follower count as a parallel social capital metric
- **PRESS-03**: Instagram presence attracts collectors motivated by visibility (vs. legacy collectors who care about art)

### Narrative Depth

- **NARR-01**: Full drug acquisition network with named dealer characters in Flatlands and Hotel District (after midnight)
- **NARR-02**: Full NPC event trees for artist and collector relationships (not just decay + bid modifiers)
- **NARR-03**: Landlord negotiation mechanic with branching outcomes based on Prestige and negotiation choices

### Sound

- **SOUND-01**: Cocktail party ambient audio plays in auction rooms
- **SOUND-02**: Gallery HVAC hum plays in gallery space
- **SOUND-03**: Airport noise plays at art fairs

### Spectator Mode

- **SPEC-01**: Players can join as spectators: full read-only view of public game state, no game interaction
- **SPEC-02**: Spectators can access in-room chat

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-money / wallet integration | Design anti-feature — NFT layer is a parallel in-game economy only |
| Play-to-earn with real tokens | Explicitly excluded; NFT economy is narrative, not financial |
| Canvas / WebGL rendering | Design principle — browser 2D only |
| Mobile native app | Browser-only target |
| Server-side rendering | Browser-only; no SSR required |
| Async / turn-based play | Real-time session only; synchronous room model |
| Undo mechanic | Not in source game; all moral compromises are permanent |
| AI opponents | v2+ at earliest; not in v1 scope |
| Cross-session statistics / achievement system | Session-scoped only in v1 |
| Economy balance constants solved before playtesting | Placeholder linear costs + transaction log; tuning is a playtesting output, not a math problem |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENG-01 | Phase 1 — Engine Hardening & Security | Pending |
| ENG-02 | Phase 1 — Engine Hardening & Security | Pending |
| ENG-03 | Phase 1 — Engine Hardening & Security | Pending |
| ENG-04 | Phase 1 — Engine Hardening & Security | Pending |
| ENG-05 | Phase 1 — Engine Hardening & Security | Pending |
| ENG-06 | Phase 1 — Engine Hardening & Security | Pending |
| ENG-07 | Phase 1 — Engine Hardening & Security | Pending |
| ENG-08 | Phase 1 — Engine Hardening & Security | Pending |
| ENG-09 | Phase 1 — Engine Hardening & Security | Pending |
| ENG-10 | Phase 1 — Engine Hardening & Security | Pending |
| AEST-01 | Phase 2 — Aesthetic System Foundation | Pending |
| AEST-02 | Phase 2 — Aesthetic System Foundation | Pending |
| AEST-03 | Phase 2 — Aesthetic System Foundation | Pending |
| AEST-04 | Phase 2 — Aesthetic System Foundation | Pending |
| AEST-05 | Phase 2 — Aesthetic System Foundation | Pending |
| AEST-06 | Phase 2 — Aesthetic System Foundation | Pending |
| AEST-07 | Phase 2 — Aesthetic System Foundation | Pending |
| AEST-08 | Phase 2 — Aesthetic System Foundation | Pending |
| AEST-09 | Phase 2 — Aesthetic System Foundation | Pending |
| AEST-10 | Phase 2 — Aesthetic System Foundation | Pending |
| AEST-11 | Phase 2 — Aesthetic System Foundation | Pending |
| SIM-01 | Phase 3 — Core Sim Loop | Pending |
| SIM-02 | Phase 3 — Core Sim Loop | Pending |
| SIM-03 | Phase 3 — Core Sim Loop | Pending |
| SIM-04 | Phase 3 — Core Sim Loop | Pending |
| SIM-05 | Phase 3 — Core Sim Loop | Pending |
| SIM-06 | Phase 3 — Core Sim Loop | Pending |
| SIM-07 | Phase 3 — Core Sim Loop | Pending |
| SIM-08 | Phase 3 — Core Sim Loop | Pending |
| SIM-09 | Phase 3 — Core Sim Loop | Pending |
| SIM-10 | Phase 3 — Core Sim Loop | Pending |
| DEPTH-01 | Phase 4 — Sim Depth | Pending |
| DEPTH-02 | Phase 4 — Sim Depth | Pending |
| DEPTH-03 | Phase 4 — Sim Depth | Pending |
| DEPTH-04 | Phase 4 — Sim Depth | Pending |
| DEPTH-05 | Phase 4 — Sim Depth | Pending |
| DEPTH-06 | Phase 4 — Sim Depth | Pending |
| DEPTH-07 | Phase 4 — Sim Depth | Pending |
| DEPTH-08 | Phase 4 — Sim Depth | Pending |
| DEPTH-09 | Phase 4 — Sim Depth | Pending |
| DEPTH-10 | Phase 4 — Sim Depth | Pending |
| NFT-01 | Phase 5 — NFT Layer & End State | Pending |
| NFT-02 | Phase 5 — NFT Layer & End State | Pending |
| NFT-03 | Phase 5 — NFT Layer & End State | Pending |
| NFT-04 | Phase 5 — NFT Layer & End State | Pending |
| NFT-05 | Phase 5 — NFT Layer & End State | Pending |
| END-01 | Phase 5 — NFT Layer & End State | Pending |
| END-02 | Phase 5 — NFT Layer & End State | Pending |
| END-03 | Phase 5 — NFT Layer & End State | Pending |
| DEPLOY-01 | Phase 6 — Deployment & Polish | Pending |
| DEPLOY-02 | Phase 6 — Deployment & Polish | Pending |
| DEPLOY-03 | Phase 6 — Deployment & Polish | Pending |

**Coverage:**
- v1 requirements: 52 total
- Mapped to phases: 52
- Unmapped: 0

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after roadmap creation*

# NFArt Auction

## What This Is

A snarky multiplayer browser game in two interlocking layers: a faithful TypeScript implementation of Modern Art (Knizia, 1992) as the auction engine, wrapped by a daily gallery sim where players manage a gallery, relationships, a drug supply, and a landlord across five neighborhoods. The two layers share a single economy. For 2–4 players in any browser, no install required.

## Core Value

Friends can complete a full 4-round Modern Art auction game online, with gallery sim decisions shaping who they are when they sit down to bid.

## Requirements

### Validated

- ✓ 4-character room code multiplayer via PartyKit WebSocket — existing
- ✓ Pure functional auction engine (TypeScript, state-in/state-out) — existing
- ✓ Five auction types implemented (open, once-around, sealed, fixed price, double) — existing
- ✓ React 19 + Tailwind frontend with lobby, waiting room, and game board — existing
- ✓ Private hands (server sends each player only their own cards) — existing
- ✓ Durable Object persistence enabling reconnects — existing

### Active

**Engine — Fix and Harden:**
- [ ] Sealed bids must not be broadcast to all clients before reveal (mechanic-breaking security bug)
- [ ] Deck must not be included in public GameState broadcast (strategic cheating vector)
- [ ] Double auction second-card enforcement: only the auctioneer may play the second card
- [ ] `isHost` must be assigned server-side by connection order, not trusted from client
- [ ] Input validation on all WebSocket message types (Zod or equivalent)
- [ ] Remove dead Supabase module, orphaned SQL files, unused zustand dependency
- [ ] Consolidate `startGame` — server should call engine function, not duplicate its logic
- [ ] Engine tests covering auction resolution, valuation, edge cases (sealed bid tie-breaking, round-end trigger, double auction)

**Aesthetic System:**
- [ ] Zine visual language: white base, black type, single accent color per neighborhood
- [ ] Neighborhood accent system: Gallery District (cold blue), Warehouse Zone (brutalist amber), Flatlands (harsh red), Hotel District (sterile beige), Online (flickering accent, wrong-loading fonts)
- [ ] Wall-label typography for all copy — drug inventory uses same format as painting collection
- [ ] Auction results render as receipts; stats display as appraisal forms
- [ ] All 5 auction types have visual skins (preview night, formal dinner, phones reveal, price tag on white wall, drop format countdown)

**Gallery Sim — Full Loop, Shallow Depth:**
- [ ] Player stats: Money, Coolness, Restedness, Luck (tracked, affect game outcomes)
- [ ] Global stats: Art Market Hotness, Gentrification Level, NFT Hype Cycle (fluctuate by round)
- [ ] Daily time slot scheduling (morning/afternoon/evening/night slots, cannot fill them all)
- [ ] All 6 slot types accessible: gallery work, studio visits, art fair, opening/event, party, sleep
- [ ] Five neighborhoods on the map; traveling costs a time slot
- [ ] Relationship system (thin stubs): named artists/collectors degrade on timer, affect bid likelihood
- [ ] Faction system (thin stubs): gallery develops alignment based on who you represent; basic stat modifiers
- [ ] Drug system (thin stubs): inventory tracked, usable at parties/fairs, passive Risk stat
- [ ] Landlord: text message arc (5 stages), Prestige-based negotiation leverage
- [ ] NFT layer unlock at Coolness threshold: parallel economy, volatile exchange rate
- [ ] End state: appraisal document render, leaderboard as auction receipt

**Deployment:**
- [ ] Deployable to a public URL (PartyKit production + static frontend host)
- [ ] No Supabase credentials required for production deploy

### Out of Scope

- Deep relationship arc mechanics (dating sim depth, full event trees) — v2 narrative expansion
- Procedurally generated art criticism text (press reviews) — v2 content layer
- Instagram feed rendering — v2 social layer
- Full drug acquisition network with named dealer characters — v1 has stubs, not full NPC trees
- Sound system (cocktail party ambience, gallery HVAC, airport noise) — v2 polish
- Canvas/WebGL rendering — browser 2D only, design principle
- Server-side rendering — browser only

## Context

The existing codebase was generated in a single prompt session implementing the Modern Art board game. The architecture is sound (pure engine + authoritative PartyKit server + dumb React client) but was never demoed or tested. Multiple bugs and security issues are documented in `.planning/codebase/CONCERNS.md`. The repo also contains a structural artifact: there appears to be a duplicate `app/` subdirectory mirroring the root — the canonical source is the root (top-level `party/server.ts`, `src/`, `package.json`).

The aesthetic system is the game's personality. The brief is unusually specific about it — the visual restraint is the bit, not a skin to apply later. It should be built into the component architecture from the start, not retrofitted.

Five artists: Lite Metal, Yoko, Christine P., Karl Gitter, Krypto. 70-card deck, Knizia card counts. Four rounds; round ends when the 5th painting of any single artist is put up for auction that round. Top 3 artists per round earn $30k/$20k/$10k per painting held; values compound across all four rounds.

## Constraints

- **Tech stack**: TypeScript + React 19 + Vite + Tailwind v4 + PartyKit — no changes to core stack
- **Rendering**: Browser-only, 2D, no canvas, no WebGL — design principle, not a limitation
- **Multiplayer**: PartyKit as authoritative server; no database required for core game
- **Deployment**: PartyKit cloud for server, static host for frontend
- **Engine architecture**: Pure functions, state-in/state-out, no side effects — invariant for testability

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Brownfield: root is canonical, `app/` is artifact | `partykit.json` points to root `party/server.ts`; root has the active lockfile | — Pending cleanup |
| Engine-first audit before sim build | Engine was never tested; bugs here corrupt everything downstream | — Pending |
| Sim layer uses same economy as auction engine | Core design principle from brief — shared war chest | — Pending |
| NFT layer as unlock (Coolness threshold), not separate mode | Narrative device: same world, same UI, slightly broken | — Pending |
| Aesthetic system built into components, not applied as theme | Visual restraint is the bit; wall-label copy is gameplay, not flavor | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-06 after initialization*

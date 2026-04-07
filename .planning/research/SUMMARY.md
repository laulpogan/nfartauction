# Project Research Summary

**Project:** NFArt Auction
**Domain:** Multiplayer browser board game + gallery life sim hybrid
**Researched:** 2026-04-06
**Confidence:** HIGH

## Executive Summary

NFArt is a two-layer product: a faithful implementation of Modern Art (Knizia, 1992) as an authoritative WebSocket auction engine, wrapped by a daily gallery sim whose stat decisions carry into bidding sessions. The core architecture is already correct — pure functional engine, authoritative PartyKit Durable Object server, dumb React clients — and must not be broken during the sim build. The right build sequence is to harden the existing auction engine before touching the sim layer at all. The engine was generated but never tested, and it contains multiple live security bugs (sealed bid values visible in the public broadcast, the full deck exposed over the wire, double-auction enforcement absent, host privilege assigned from a client-sent flag). Building the sim on top of an untested engine multiplies every bug. Engine hardening and tests come first; the sim extends on top.

The sim layer integrates into the same PartyKit room as the auction engine — not a separate room, not a separate service. The two layers share a single money pool, which is the game's core design principle. The sim state splits into two domains: shared world state (`SimState`, public) and per-player private state (`PlayerSimState`, sent only to its owner, mirroring the existing `YOUR_HAND` pattern). Zustand 5, already installed and currently unused, activates as two stores — one ephemeral session store and one localStorage-persisted player store — for client-side UI state that does not belong in the authoritative server. Zod 4 adds runtime validation on every inbound WebSocket message path, closing the current type-casting vulnerability.

The critical risks are all front-loaded in the existing codebase: four of the top six pitfalls are already present in the code and will corrupt any session run today. Fixing them is not optional cleanup — it is the prerequisite for any further development. The secondary risk is the sim economy: do not attempt to balance it mathematically during implementation. Placeholder linear costs configured as constants, exposed via a dev-mode transaction log, let playtesting surface the actual imbalance instead of guessing ahead of time. The NFT parallel economy follows the same principle: build the visual/narrative unlock first; defer the separate volatile ledger until the base economy is stable.

---

## Key Findings

### Recommended Stack

The core stack is fully locked by project constraints (TypeScript, React 19, Vite, Tailwind 4, PartyKit 0.0.115). Research focused on the gaps: what to add, what to activate, and what to remove. The headline decision is to activate Zustand 5 (already installed, currently dead code) as two named stores for client-side sim state. Zod 4 (new install, 14x faster than Zod 3 on the Cloudflare Worker budget) validates all inbound WebSocket messages. Vitest 4 adds a unit test runner against the pure functional engine with zero config overhead. Supabase is dead code and must be removed before any deployment. Deployment target is Cloudflare Pages for the static frontend (same CDN as PartyKit, minimizes WebSocket handshake latency) paired with the existing `npx partykit deploy` workflow.

See `.planning/research/STACK.md` for full dependency delta, version rationale, and rejected alternatives.

**Core technologies:**
- TypeScript 6 + React 19 + Vite 8 + Tailwind 4: LOCKED — full-stack foundation
- PartyKit 0.0.115 + PartySocket 1.1.16: LOCKED — authoritative WebSocket server on Cloudflare Durable Objects
- Zustand 5.0.12 (already installed): ACTIVATE — two stores (`useSimSessionStore` ephemeral, `useSimPlayerStore` persisted via localStorage) for client-side sim UI state
- Zod 4 (new install): ADD — discriminated union schema for all WebSocket message types; shared between server and client
- framer-motion 12.38.0 (already installed): USE AS-IS — card reveal animations, auction panel transitions, bid feedback; CSS keyframes for receipt/print effects and typewriter text
- Vitest 4 + @testing-library/react (new install, dev-only): ADD — unit tests on the pure functional engine; zero Vite config overhead
- Cloudflare Pages: DEPLOY — static frontend host; same CDN as PartyKit server
- @supabase/supabase-js + src/lib/supabase.ts: REMOVE — dead code; no database in the architecture

**Hard stops (do not add):** tRPC, React Query, Prisma/Drizzle, Socket.io, Canvas/WebGL, Next.js/Remix, superjson, Redux Toolkit.

### Expected Features

The full feature breakdown is in `.planning/research/FEATURES.md`. The MVP sequence derived from dependency analysis:

**Must have (table stakes — any playable session requires these):**
- Sealed bid security fix (currently bids are fully visible in raw WebSocket frames)
- Deck exclusion from public broadcast (currently a strategic cheating vector)
- Double auction second-card enforcement (only the auctioneer may play the second card)
- Turn indicator: unambiguous "waiting for X" states visible to all non-acting players
- Auction resolution receipt display (emotional payoff of each auction)
- Reconnect recovery for `roundEndResult` (round summary lost on disconnect)
- Stat display: Money, Coolness, Restedness, Luck (wall-label format)
- Time slot scheduling with slot-type UI (core sim loop)
- Shared economy: sim money and auction money are visibly the same number
- Zine aesthetic system baked into all components from the start — not retrofitted

**Should have (define the game's identity — differentiators):**
- Auction type visual skins (5 types, 5 distinct moods)
- Global stats: Art Market Hotness, Gentrification Level, NFT Hype Cycle
- Landlord text message arc (5-stage escalation, Prestige-gated)
- Relationship stubs with exponential decay timer (affect bid likelihood)
- Drug inventory tracked alongside paintings on the same appraisal form
- End-state appraisal document with templated art-criticism text
- Spectator mode (full view, no action, chat)
- Auction history log (receipt stack, expandable)

**Defer to v2+:**
- Faction narrative depth (v1: stat modifier stubs only)
- Procedural art criticism via LLM (v1: fixed template pool)
- Sound system
- Deep NPC relationship trees / full drug acquisition network
- Instagram feed, AI opponents, achievement system, cross-session statistics

**Explicit anti-features (never build):** play-to-earn with real tokens, wallets/crypto onboarding, async/turn-based play, undo mechanic, per-session statistics across sessions, Canvas/WebGL, SSR.

### Architecture Approach

The existing pattern — pure functional engine → authoritative PartyKit server → dumb React clients — is correct and must not be violated. The sim layer extends it without changing it: a new `sim-engine.ts` module (pure functions, same pattern as `engine.ts`) handles slot resolution, relationship decay, and stat effects server-side. The server owns two new top-level state domains alongside the existing auction state: `SimState` (public, broadcast to all) and `Map<sessionId, PlayerSimState>` (private, sent per-connection via `YOUR_SIM_STATE` messages). The game alternates between `sim_day` and `auction_round` phases; the server owns phase transitions via a discriminated union on `GameState.phase`. The client routes on `game.phase.type` to render either `SimPanel` or `AuctionPanel`.

See `.planning/research/ARCHITECTURE.md` for full type definitions, data flow diagrams, and KV storage strategy.

**Major components:**
1. `src/lib/engine.ts` — pure functional auction rules; no changes during sim build
2. `src/lib/sim-engine.ts` (new) — pure functional sim rules: slot resolution, relationship decay, stat effects, sim modifiers injected into auction inputs
3. `party/server.ts` — authoritative state holder; extended with phase machine, `SUBMIT_SLOTS` handler, `YOUR_SIM_STATE` dispatch, KV split into separate keys
4. `src/hooks/useSim.ts` (new) — mirrors `useGame`; routes sim WebSocket messages; holds `draftSlots` local staging state
5. `src/components/sim/SimPanel.tsx` (new) — slot picker, neighborhood map, stat bars, drug inventory, landlord arc
6. `src/pages/GamePage.tsx` — extended phase routing switch; no structural change to AuctionPanel
7. Zustand stores: `useSimSessionStore` (ephemeral UI state) + `useSimPlayerStore` (localStorage-persisted between sessions, scoped to room+player)

### Critical Pitfalls

The top 5 pitfalls to design around from day 1 — four of these are already present in the live codebase:

1. **Sealed bid values in public broadcast (PRESENT)** — `AuctionState.sealedBids` is broadcast verbatim to all clients. Fix: implement `derivePublicState(state, playerId)` projection on the server before any other work. Replace `sealedBids` amounts with a presence-only `sealedBidsSubmitted: Set<number>` until reveal. This projection function is the prerequisite for all downstream security fixes.

2. **Full deck exposed in public GameState (PRESENT)** — `GameState.deck` (all remaining cards in order) is in the broadcast object. Strip `deck` entirely from the broadcast; it is server-only state. Clients receive their own hand via the existing `YOUR_HAND` message.

3. **No WebSocket input validation (PRESENT)** — All message fields are type-cast without runtime validation (`msg.card as Card`, `msg.amount as number`). A malicious client can submit negative bids, cards not in their hand, or NaN amounts that permanently break game arithmetic. Fix: Zod 4 discriminated union schema parsed at the top of `onMessage`; reject invalid inputs before they reach the engine.

4. **Round-end trigger fires after auction resolves instead of before (PRESENT risk)** — The Knizia rule: the fifth painting of any artist is NOT sold; the round ends when it is put up for auction. If the trigger fires post-resolution, the round-ending player incorrectly profits. Fix: check the fifth-card threshold in `playCard` (before auction creation), not in `resolveAuction`. Confirm against the official rulebook — do not guess the rule.

5. **Sim economy imbalance — do not fix it in code** — The shared economy will not balance cleanly from first principles. Attempting to solve it mathematically during implementation stalls development. Fix: hard-code simple linear costs as named constants in a config object, add a dev-mode transaction log for playtesting, and accept that the numbers will be wrong until humans play sessions and surface the actual problem.

---

## Implications for Roadmap

Based on the combined research, the dependency structure is unambiguous: engine hardening before sim, types before logic, server before client, core loop before differentiators.

### Phase 1: Engine Hardening and Security

**Rationale:** Four of the six critical pitfalls are present in the live codebase. The engine was generated and never tested. Building the sim on top of broken, untested auction mechanics multiplies every bug downstream and makes later debugging impossible. This phase has no dependencies on new features — it only fixes what exists.

**Delivers:** A trustworthy, tested auction engine that any subsequent phase can build on. A clean deployment without dead Supabase code.

**Addresses:** Table-stakes auction features (sealed bid integrity, double auction enforcement, turn clarity, round-end scoring accuracy, reconnect recovery).

**Avoids:** Pitfalls 1, 2, 3, 4, 6 (sealed bid leak, deck leak, no input validation, round-end trigger, double auction enforcement) — all critical, all currently present.

**Key tasks:**
- Implement `derivePublicState(state, playerId)` — strips sealed bids and deck from broadcast
- Fix double auction: server enforces only auctioneer plays second card
- Fix `isHost` to be assigned server-side by connection order
- Fix round-end trigger: check fifth-card threshold pre-auction-creation
- Add Zod 4; validate all inbound message types
- Consolidate `startGame` — server calls engine function, removes inline duplicate
- Remove Supabase module and orphaned SQL files
- Add Vitest 4; write engine tests covering all five auction types, tie-breaking, round-end trigger, double-auction enforcement
- Fix `lastRoundResult` persistence in Durable Object for reconnect recovery

**Research flag:** Standard patterns — no research phase needed. All fixes are defined and scoped.

---

### Phase 2: Aesthetic System Foundation

**Rationale:** The aesthetic system is the game's personality and must be built into component architecture from the start, not retrofitted. Every subsequent phase adds UI components. If the visual system is not established first, it gets applied inconsistently or requires structural refactoring after the fact. This phase establishes the design language that all sim and differentiator phases build on.

**Delivers:** A visual system (zine language, wall-label typography, neighborhood accent colors, receipt renders) applied to the existing auction UI. All five auction types get visual skins.

**Addresses:** Aesthetic system requirements from PROJECT.md; auction type visual skins (differentiator).

**Avoids:** The pitfall of retrofitting aesthetics — "built into component architecture, not applied as a skin later" is a direct quote from both PROJECT.md and FEATURES.md.

**Key tasks:**
- Establish Tailwind design tokens: white base, black type, five neighborhood accent colors
- Wall-label typography component (shared across auction results, stat displays, drug inventory)
- Auction result receipt component (used by all five auction types post-resolution)
- Five auction type visual skins (preview night, formal dinner, phones reveal, price tag, drop countdown)
- Neighborhood accent system applied to neighborhood-scoped UI regions

**Research flag:** Standard patterns — CSS/Tailwind implementation is well-documented.

---

### Phase 3: Core Sim Loop

**Rationale:** The sim loop (time slot scheduling → server resolution → stat updates → phase transition back to auction) is the architectural backbone of the gallery sim. It establishes the `sim_day` phase, the `SimState` + `PlayerSimState` types, the `sim-engine.ts` module, the `useSim` hook, and the `SUBMIT_SLOTS` message path. All subsequent sim features (relationships, drug system, NFT layer, landlord arc) are additive to this foundation. Building them before the loop exists creates floating features with no home.

**Delivers:** A fully functional day cycle — players schedule time slots, submit, server resolves, stats update, economy flows, phase transitions to next auction round.

**Addresses:** Stat display (Money, Coolness, Restedness, Luck), time slot scheduling, neighborhood map, shared economy (sim money = auction money, visually unified).

**Avoids:** Architecture anti-pattern of client-authoritative sim state; polling instead of push; merging sim engine into auction engine; separate rooms per player.

**Key tasks:**
- Type extension: `GamePhase` discriminated union, `SimState`, `PlayerSimState`, `PlayerSimState`, new message types
- `src/lib/sim-engine.ts`: `resolveSlots()`, `advanceDay()`, `applySimModifiers()` — pure functions, fully tested
- Server phase machine: `sim_day` ↔ `auction_round` transitions, `SUBMIT_SLOTS` handler, `YOUR_SIM_STATE` dispatch, 60-second hard timeout
- KV storage split into multiple keys to avoid 128 KiB per-value limit (Pitfall 9)
- `useSim` hook: mirrors `useGame`, routes sim messages, holds `draftSlots` local staging state
- `SimPanel` component: slot picker with optimistic UI, neighborhood map, stat display in wall-label format
- `GamePage` phase routing switch: `lobby` / `sim_day` / `auction_round` / `game_over`
- Activate `useSimSessionStore` (ephemeral) and `useSimPlayerStore` (localStorage-persisted) Zustand stores
- Global stats display: Art Market Hotness, Gentrification Level, NFT Hype Cycle
- Economy constants config object — no magic numbers; dev-mode transaction log for playtesting

**Research flag:** Moderate complexity — the phase machine and state privacy model are well-specified in ARCHITECTURE.md. No additional research needed; implementation follows the specified patterns directly.

---

### Phase 4: Sim Depth (Relationships, Landlord, Drug System)

**Rationale:** These three systems are the sim's differentiators. They are additive to the stable Phase 3 loop — they plug into the existing slot resolution and stat update paths without changing the core architecture. Building them together makes sense because they share the same data pattern: named stubs with a decay or progression mechanic, displayed in the wall-label format already established in Phase 2.

**Delivers:** Named artist/collector relationships with exponential decay (affecting bid likelihood by ±10-15%); landlord text message arc (5 stages, Prestige-gated); drug inventory tracked alongside paintings on the same appraisal form.

**Addresses:** Relationship system stubs, faction system stubs, drug system stubs, landlord arc — all explicitly required in PROJECT.md for v1.

**Avoids:** Pitfall 14 (linear decay feels punishing — use exponential decay to a floor, discrete at round transitions); over-engineering NPC depth (v1 is stubs, not event trees).

**Key tasks:**
- `Relationship[]` in `PlayerSimState`: named artists/collectors, score, decay timer
- Exponential decay function in `sim-engine.ts`: `score = max(floor, score * decayFactor)` per round transition
- Relationship visibility indicator (fading → cold state visible before score hits floor)
- Bid likelihood modifier: relationship score maps to ±10-15% modifier passed via `applySimModifiers()`
- Landlord arc: 5 authored text stages, Prestige threshold gates, text-message format in wall-label typography
- Drug system: `DrugItem[]` in `PlayerSimState`, quantity tracked, acquisition via time slot cost (abstracted), passive Risk stat accumulation
- Drug inventory renders on same appraisal form as painting collection (same component, different fields)
- Faction alignment stubs in `PlayerSimState`: stat modifiers only, no narrative depth

**Research flag:** Relationship decay curve and faction modifier values will need playtesting calibration. The mechanic patterns are well-specified; the numbers are not. Flag for economy tuning after first playtest session.

---

### Phase 5: NFT Layer and End State

**Rationale:** The NFT parallel economy is Coolness-gated and entirely additive — it activates as an overlay when the threshold is crossed, adding a second ledger and volatile exchange rate without touching the core auction economy. The end-state appraisal document aggregates all four rounds and requires the full sim data that only exists after Phase 4. These belong together because they are both output/reward systems that depend on the complete game loop being stable.

**Delivers:** NFT unlock at Coolness threshold (visual/narrative overlay first, volatile exchange rate second); `CONVERT_NFT` action to transfer between economies; end-state appraisal document with templated art-criticism text; leaderboard as auction receipt; spectator mode.

**Addresses:** NFT layer unlock, parallel economy with volatile exchange rate, end-state appraisal document, spectator mode.

**Avoids:** Pitfall 15 (double economy complexity before base is stable — visual unlock first, separate balance second); NFT money flowing directly into auction pool without explicit conversion; any real-money or wallet integration.

**Key tasks:**
- NFT unlock: server sets `playerSim.nftWalletUnlocked = true` when `coolness >= NFT_COOLNESS_THRESHOLD`; client reveals NFT panel without reload
- `NftEconomy` in `PlayerSimState`: `nftWallet`, `exchangeRate`, `heldNfts`
- Exchange rate as config multiplier on `SimState.nftHypeCycle`; volatile drift per sim day; no direct flow to auction money
- `CONVERT_NFT` message: server validates, deducts `nftWallet`, adds to `player.money`
- NFT UI skin: same components, "slightly broken" aesthetic (flickering accent, wrong-loading font cues in Online neighborhood)
- End-state appraisal document: template-based text with stat/choice-keyed conditional branches; 10-20 authored templates per artist
- Leaderboard rendered as auction receipt (same component as auction resolution receipt)
- Spectator mode: full read-only view, chat access, no game interaction

**Research flag:** NFT volatile exchange rate formula is a config value, not a derived formula — no research needed. End-state text templates require editorial authoring, not technical research.

---

### Phase 6: Deployment and Polish

**Rationale:** Deployment configuration should come after the full feature set is stable, not before. This phase also covers the `app/` directory cleanup (Pitfall 16), PartyKit version pinning verification (Pitfall 17), and auction history log (which requires all auction types and round data to be stable).

**Delivers:** Public URL deployment (Cloudflare Pages + PartyKit production); auction history log (receipt stack, expandable); broadcast optimization (lightweight action events for non-structural updates); clean repo.

**Addresses:** Deployment requirements, Pitfall 8 (full state broadcast growth with roundHistory), Pitfall 16 (duplicate app/ directory), Pitfall 17 (PartyKit pre-1.0 version pinning).

**Key tasks:**
- Delete `app/` subdirectory in a single cleanup commit before deploy
- Verify `package.json` pins `"partykit": "0.0.115"` without caret
- Cloudflare Pages configuration: `VITE_PARTYKIT_HOST` env var, `public/_redirects` for SPA routing
- Remove `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from any deployed environment
- Auction history log: condensed receipt stack, expandable, covers all four rounds
- Broadcast optimization: lightweight action events for bid placements; full `GAME_STATE` reserved for structural transitions

**Research flag:** Standard patterns — Cloudflare Pages Vite deployment is well-documented. No research phase needed.

---

### Phase Ordering Rationale

- **Engine before sim:** The auction engine is the foundation. Four critical bugs are present now. The sim's stat modifiers, economy sharing, and phase transitions all depend on correct auction resolution.
- **Aesthetics before sim UI:** The wall-label format, receipt component, and neighborhood accent system are used by every sim component. Establishing them in Phase 2 means Phase 3-5 components are consistent by default.
- **Core loop before depth:** Phase 3 establishes `SimState`, `PlayerSimState`, the phase machine, and `sim-engine.ts`. Phases 4-5 are purely additive within that container.
- **NFT last among features:** It is Coolness-gated and additive. The base economy must be stable and playtested before a volatile second ledger makes debugging legible.
- **Deployment last:** Eliminates the risk of configuring a deployment pipeline against a moving target. The `app/` directory cleanup is a hard prerequisite for deployment.

### Research Flags

Phases with well-documented patterns (no additional research phase recommended):
- **Phase 1** — Bugs are identified; fixes are specified; Zod 4 and Vitest 4 have current documentation.
- **Phase 2** — CSS/Tailwind/framer-motion patterns are well-established.
- **Phase 6** — Cloudflare Pages Vite deployment has official documentation.

Phases where implementation details may need validation:
- **Phase 3** — The 60-second sim day timeout and KV storage key split are specified; verify the PartyKit `0.0.115` storage API shape matches the documented pattern before implementation.
- **Phase 4** — Economy constants (slot costs, travel costs, relationship decay factor, bid likelihood modifier range) are placeholders. These are config values, not research questions — but the values need a first-pass calibration before the first playtesting session.
- **Phase 5** — The NFT exchange rate volatility formula is unspecified beyond "config multiplier on nftHypeCycle." Define the formula before implementation; it is a small design decision, not a research question.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core stack locked; gap-fill decisions (Zustand, Zod 4, Vitest 4, Cloudflare Pages) verified against official documentation and confirmed installs |
| Features | HIGH | Table-stakes and differentiators are well-defined; anti-features are explicit with rationale; v2 scope is clearly bounded |
| Architecture | HIGH (core), MEDIUM (sim integration details) | Single-room pattern, state domains, and privacy model are well-specified; sim modifier values and economy balance are design decisions, not research gaps |
| Pitfalls | HIGH | Critical pitfalls 1, 2, 4, 6 are confirmed by direct codebase inspection (CONCERNS.md); pitfalls 3, 5 are rules-logic issues with clear test prescriptions |

**Overall confidence:** HIGH

### Gaps to Address

- **Economy balance constants:** Slot costs, travel costs, relationship decay factor, bid likelihood modifier range are all placeholder values. These are design decisions resolved by playtesting, not research. Expose as a config object in Phase 3 and instrument with a dev-mode transaction log. Do not attempt to set correct values before the first human playtest.
- **NFT exchange rate formula:** The volatility model is described qualitatively ("drifts randomly per sim day, capped 0-200%") but the specific formula is unspecified. Define this before Phase 5 begins. It is a small authorial decision, not a research question.
- **Sealed bid tie-break rule:** The Knizia rulebook tie-break is "leftmost player from the auctioneer wins." The current implementation has an unverified edge case for when the auctioneer is involved in a tie. Verify against the official rulebook PDF (linked in PITFALLS.md sources) during Phase 1 before writing tests.
- **framer-motion performance at game-board scale:** ARCHITECTURE.md notes that `layoutId` and `AnimateSharedLayout` have known performance costs with many simultaneous DOM elements. The actual perf threshold for this project's component count is untested. Use explicit enter/exit variants (not `layoutId`) by default; benchmark if jank appears in Phase 2-3 development.
- **PartyKit 0.0.115 storage API shape:** The PITFALLS.md notes that the new `partyserver` package may use a SQLite backend with 2 MB row limits vs the legacy 128 KiB KV limit. Verify which backend `0.0.115` uses before implementing the KV storage split in Phase 3. This affects whether the two-key split strategy is necessary.

---

## Sources

### Primary (HIGH confidence)
- Zustand persist middleware: https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data
- Zod 4 release and performance: https://zod.dev/v4 and https://www.infoq.com/news/2025/08/zod-v4-available/
- PartyKit input validation (recommends Zod): https://docs.partykit.io/guides/validating-client-inputs/
- PartyKit persisting state: https://docs.partykit.io/guides/persisting-state-into-storage/
- PartyKit room isolation model: https://docs.partykit.io/how-partykit-works/
- Cloudflare Durable Objects storage limits: https://developers.cloudflare.com/durable-objects/platform/limits/
- Cloudflare Pages + Vite React deploy: https://developers.cloudflare.com/workers/framework-guides/web-apps/react/
- Vitest 4 release: https://vitest.dev/blog/vitest-4
- Board Game Arena spectator mode: official platform documentation
- The Sims relationship decay: official wiki, documented mechanic
- Modern Art rulebook (PDF): https://www.base23.com/rulebooks/ma_rulebook_3rd_EN.pdf
- Modern Art BGG entry: https://boardgamegeek.com/boardgame/118/modern-art
- Codebase concerns audit: `.planning/codebase/CONCERNS.md`

### Secondary (MEDIUM confidence)
- Scalable WebSocket game architecture: https://blog.hathora.dev/scalable-websocket-architecture/
- Turn-based multiplayer server authority patterns: https://longwelwind.net/blog/networking-turn-based-game/
- React state management for WebSocket games: https://makersden.io/blog/react-state-management-in-2025
- Zustand vs Jotai vs Valtio 2025: https://www.reactlibraries.com/blog/zustand-vs-jotai-vs-valtio-performance-guide-2025
- NFT game economy failure patterns: arXiv 2602.13882; Reason.com Axie Infinity collapse
- Stardew Valley energy system design analyses (multiple, 2023-2024)
- Spiritfarer relationship mechanic (Springer Nature, 2024)

### Tertiary (LOW confidence — needs playtesting validation)
- Economy balance constants (slot costs, travel costs, decay factors): no research source; placeholder values only
- NFT exchange rate volatility formula: qualitative description only; specific formula is a design decision

---
*Research completed: 2026-04-06*
*Ready for roadmap: yes*

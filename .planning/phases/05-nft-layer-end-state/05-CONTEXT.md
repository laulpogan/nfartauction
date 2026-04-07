# Phase 5: NFT Layer & End State - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Source:** Extracted from PROJECT.md brief + research findings

<domain>
## Phase Boundary

Two output/reward systems that complete the v1 game loop: the Coolness-gated NFT parallel economy and the end-state appraisal document. Both are additive — the NFT layer activates as an overlay, and the end state aggregates Phase 3-4 sim data into a final summary.

In scope:
- NFT panel unlock at Coolness threshold (in-game DM trigger)
- NftEconomy: nftWallet, exchangeRate, heldNfts (parallel ledger)
- Volatile exchange rate driven by NFT Hype Cycle global stat
- Explicit CONVERT_NFT message (no automatic flow between economies)
- Faction reactions to NFT activity (Sculptors outraged, Social/Political denouncement)
- End state: 4-round game over → printed appraisal document
- Templated art-criticism text generation
- Leaderboard rendered as auction receipt
- Online neighborhood UI activation (uses existing OnlineNeighborhood from Phase 2)

Out of scope (v2):
- Spectator mode
- Real money / wallet integration
- Procedural LLM-generated criticism
- Cross-session statistics

</domain>

<decisions>
## Implementation Decisions

### Architecture (additive to Phase 3-4)
- New state in `PlayerSimState`: `nftWallet`, `nftWalletUnlocked`, `heldNfts: NftItem[]`
- New global state in `SimState`: extend `nftHypeCycle` to actually drive exchange rate
- New pure functions in `sim-engine.ts`: `convertNft()`, `purchaseNftWhitelist()`, `applyNftHypeDrift()`
- New server message: `CONVERT_NFT`, `PURCHASE_NFT_WHITELIST` (Zod-validated, extends discriminated union)
- Coolness threshold check: server detects crossing → sends DM message, sets `nftWalletUnlocked = true`
- Faction reaction: NFT actions trigger relationship score changes for Sculptors / Social-Political faction-aligned characters

### NFT Economy
- `nftWallet`: integer (NFT-currency, separate from main money)
- `exchangeRate`: float, derived from `nftHypeCycle` (e.g., `0.5 + nftHypeCycle/100 * 1.5`)
- `heldNfts`: array of items, each has rarity and base value
- Conversion: explicit `CONVERT_NFT` action with amount → server validates → `nftWallet -= amount`, `player.money += amount * exchangeRate`
- Hype drift: each sim day, `nftHypeCycle` shifts by ±10 (random walk, capped 0-100)

### NFT Activity Triggers
- `purchaseNftWhitelist`: small NFT cost, chance to receive an NftItem (random rarity)
- Each NFT activity tick increments faction reaction counters
- Sculptor-aligned character relationships: -3 per NFT action
- Social-political relationships: -5 per NFT action + denouncement notification

### End State System
- Trigger: server transitions to `phase: { type: 'game_over' }` after round 4 auction completes
- Server computes final appraisal data per player: faction mix, neighborhood history, NFT exposure depth, key relationships, win/loss
- Templated text: 10-20 templates per faction with conditional clauses based on stats
- Rendered as `<Receipt>` component using Phase 2 primitives
- Leaderboard: also rendered as `<Receipt>` using receipt format already in `GameOverModal`

### UI Components
- `NftPanel.tsx` — wraps content in `<OnlineNeighborhood>` (Phase 2 component) for the broken-font/flicker aesthetic
- `EndStateAppraisal.tsx` — printed document with WallLabel headers, Receipt-style body
- Update `GameOverModal.tsx` to render `EndStateAppraisal` after final round

### Reused from earlier phases
- All UI uses Phase 2 aesthetic primitives + OnlineNeighborhood
- All server logic follows Phase 1 Zod validation pattern
- All sim mutations stay pure in sim-engine.ts; entropy in party/server.ts

### Claude's Discretion
- Coolness threshold value (placeholder, e.g., 60)
- Exact exchange rate formula
- NFT item names and rarities
- Appraisal text templates
- Notification copy for denouncements

</decisions>

<canonical_refs>
## Canonical References

### Project Specs
- `.planning/PROJECT.md` — NFT and end-state requirements
- `.planning/REQUIREMENTS.md` — NFT-01 through NFT-05, END-01 through END-03
- `.planning/research/SUMMARY.md` — Phase 5 architecture notes (NFT exchange rate as config)
- `.planning/research/FEATURES.md` — End state generation feature

### Phase 2-4 Outputs (must consume)
- `src/components/aesthetic/OnlineNeighborhood.tsx` — broken-font wrapper (Phase 2)
- `src/components/aesthetic/Receipt.tsx` — Phase 2
- `src/components/aesthetic/WallLabel.tsx` — Phase 2
- `src/lib/sim-engine.ts` — extend with NFT functions
- `src/lib/sim-config.ts` — extend with NFT data
- `src/types/game.ts` — extend PlayerSimState/SimState
- `party/server.ts` — extend with new message handlers, end-game trigger
- `src/components/game/GameOverModal.tsx` — replace with EndStateAppraisal

</canonical_refs>

<specifics>
## Specific Ideas

- NFT DM unlock message: "you've crossed the threshold. welcome to the chain. — anonymous"
- Denouncement notification format: tweet-style block in WallLabel
- Appraisal document opens with "PRINTED APPRAISAL — ESTATE OF [GALLERY NAME]"
- Template clauses keyed on faction dominance, NFT exposure depth, rounds in flatlands
- Final receipt: 4 rounds itemized, total money, place, three-sentence procedural epitaph

</specifics>

<deferred>
## Deferred Ideas

- Full NPC drug network (v2)
- Spectator mode (v2)
- Procedural critic reviews (v2)
- Achievement system (v2)

</deferred>

---

*Phase: 05-nft-layer-end-state*
*Context gathered: 2026-04-06*

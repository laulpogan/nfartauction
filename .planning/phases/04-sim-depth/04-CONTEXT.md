# Phase 4: Sim Depth - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Source:** Extracted from PROJECT.md brief + research findings

<domain>
## Phase Boundary

This phase adds the three differentiator systems on top of the Phase 3 sim loop: relationships with exponential decay, the landlord text-message arc with Prestige gating, and drug inventory + Risk stat. All three plug into the existing slot resolution and stat update paths without changing the core architecture established in Phase 3.

In scope:
- Named artist and collector relationship characters with decay
- Relationship score → bid likelihood modifier
- "Cold" relationship visual warning state
- Landlord 5-stage text message arc
- Prestige stat (gallery prestige tracking)
- Drug inventory + Risk stat
- Drug acquisition slot effects (parties, art fairs)
- Drug use Coolness/Restedness modifiers
- Faction alignment stubs (modifiers only, not narrative depth)
- "The Artist You Shouldn't Have Dropped" passive Credibility penalty

Out of scope (Phase 5):
- NFT layer
- End state appraisal document
- Spectator mode

</domain>

<decisions>
## Implementation Decisions

### Architecture (additive to Phase 3)
- All new state lives in `PlayerSimState` (private per-player) — relationships, drugs, faction, landlord stage
- All new logic lives in `sim-engine.ts` as additional pure functions: `decayRelationships()`, `applyDrugEffects()`, `progressLandlord()`, etc.
- Slot resolution in `resolveSlots()` (Phase 3) is extended to call these new functions
- No new server message types — existing SUBMIT_SLOTS handles everything
- New UI components live alongside Phase 3 sim components

### Relationship System
- Named characters: 5 artists (matching the auction artists Lite Metal, Yoko, Christine P., Karl Gitter, Krypto) + 5 collectors (named, gallery-bio descriptions)
- Each has: `name`, `factionAlignment`, `relationshipScore` (0-100), `decayTimer` (rounds since contact)
- Decay function: `score = max(0, score * 0.85^roundsSinceContact)` exponential
- Cold state visible when score < 25 (warning)
- Faction-aligned bonus events from contact

### Bid Likelihood Modifier
- High relationship (>75) → +10-15% bid likelihood for that character in next auction
- Cold relationship (<25) → -10-15% bid likelihood
- Modifier applied via `applySimModifiers()` injection into auction inputs (already a hook from Phase 3)

### Landlord Arc (5 stages)
1. Friendly heads-up about "a slight lease adjustment"
2. Meeting request
3. New lease with new terms
4. Renovation notice
5. You're out — relocation event

- Progression gated by gallery `prestige` stat (already added in Phase 3)
- High prestige delays progression; low prestige accelerates it
- Messages render via WallLabel typography (text-message style)
- Stages stored in `PlayerSimState.landlordStage` (1-5)

### Drug System
- Inventory: `DrugItem[]` in PlayerSimState — quantity tracked
- Acquisition: passive at Flatlands/Hotel slots (probability based)
- Use cases: at parties (+Coolness, -Restedness) and at art fairs (give to collectors → relationship boost)
- Risk stat: increments when carrying drugs above threshold (5 units)
- Risk causes friction events: passive Coolness drag, occasional negative slot outcomes

### Faction System (stubs only — no narrative depth)
- Player has aggregate `factionAlignment` derived from artist relationships
- Factions: `painters`, `sculptors`, `video_art`, `social_political`
- Stat modifiers per faction (from PROJECT.md brief table)
- Simple aggregation: sum positive relationships by artist faction

### The Artist You Shouldn't Have Dropped
- At game start, server randomly picks one of the 5 auction artists per player
- That artist starts with `relationshipScore: -50` and `isDroppedArtist: true`
- Passive Credibility penalty proportional to that artist's current market value
- Repairable via repeated positive contact events

### Reused from Phase 3
- All UI uses Phase 2 aesthetic primitives
- All state mutations go through sim-engine.ts pure functions
- Privacy: all new state is per-player private via YOUR_SIM_STATE

### Claude's Discretion
- Specific character names and gallery-bio descriptions
- Exact decay constant (0.85 placeholder)
- Risk threshold (5 units placeholder)
- Landlord message text
- UI layout for relationships/landlord/drugs panels

</decisions>

<canonical_refs>
## Canonical References

### Project Specs
- `.planning/PROJECT.md` — Sim depth requirements (DEPTH-01 through DEPTH-10)
- `.planning/REQUIREMENTS.md` — Requirement details
- `.planning/research/SUMMARY.md` — Phase 4 architecture notes
- `.planning/research/FEATURES.md` — Relationship/landlord/drug feature breakdown

### Phase 3 Outputs (must extend, not replace)
- `.planning/phases/03-core-sim-loop/03-01-SUMMARY.md` — sim types, sim-engine, sim-config
- `.planning/phases/03-core-sim-loop/03-02-SUMMARY.md` — phase machine, message handlers
- `.planning/phases/03-core-sim-loop/03-04-SUMMARY.md` — SimPanel components
- `src/lib/sim-engine.ts` — extend with new functions
- `src/lib/sim-config.ts` — extend with character data, drug data, landlord text
- `src/types/game.ts` — extend PlayerSimState with new fields
- `src/components/sim/SimPanel.tsx` — extend with new sub-panels

### Phase 2 Aesthetic Primitives
- `src/components/aesthetic/WallLabel.tsx`
- `src/components/aesthetic/Receipt.tsx`
- `src/components/aesthetic/AppraisalForm.tsx`

</canonical_refs>

<specifics>
## Specific Ideas

- Relationship panel: list of named characters as appraisal forms, score visible, cold-state warning chip
- Landlord text message UI: rendered as iMessage-style bubble in WallLabel typography
- Drug inventory: appraisal form lookalike to painting collection ("Untitled (White), mixed media, 2024" = 1g coke)
- Risk stat: small wall label indicator next to other stats

</specifics>

<deferred>
## Deferred Ideas

- Full NPC event trees (v2)
- Drug dealer character network (v2)
- Landlord branching outcomes (v2)
- Critic faction system (v2 PRESS layer)

</deferred>

---

*Phase: 04-sim-depth*
*Context gathered: 2026-04-06*

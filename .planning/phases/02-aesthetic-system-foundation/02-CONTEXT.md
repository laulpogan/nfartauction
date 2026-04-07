# Phase 2: Aesthetic System Foundation - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Source:** Extracted from PROJECT.md brief + research SUMMARY.md

<domain>
## Phase Boundary

This phase establishes the visual language for the entire game. Every component built in subsequent phases (Sim, Sim Depth, NFT, End State) inherits from this foundation. The aesthetic is the game's personality — visual restraint is the bit, not a skin to apply later. It must be built into component architecture from the start, not retrofitted.

In scope:
- Tailwind v4 design tokens for the zine visual language
- Wall-label typography component (used by every game text element)
- Receipt component (used by all auction resolutions, leaderboard, end state)
- Appraisal form component (used by stat displays, drug inventory)
- Five neighborhood accent color systems
- Visual skin for all 5 auction types
- Online neighborhood broken-font/flickering aesthetic

Out of scope (later phases):
- Sound effects (v2)
- Sim layer components (Phase 3)
- Relationship/landlord/drug UI (Phase 4)
- NFT panel UI (Phase 5)
- End state appraisal document (Phase 5)

</domain>

<decisions>
## Implementation Decisions

### Visual Language (locked from PROJECT.md brief)
- **Base palette:** White background, black type, ONE accent color visible at any time
- **No multi-color schemes** — accent shifts by neighborhood context
- **Negative space is excessive by design** — not a refinement
- **Typography:** Small caps headers, dry wall-label copy for everything

### Neighborhood Accent Colors (locked from brief)
- Gallery District: cold institutional blue
- Warehouse Zone: brutalist amber
- The Flatlands: harsh red
- Hotel District: sterile beige
- Online (NFT layer): same UI but fonts load wrong, accent color flickers on randomized interval

### Component Architecture
- All copy goes through a `<WallLabel>` component — never raw text
- All auction outcomes render as `<Receipt>` — not modal cards
- All stat displays render as `<AppraisalForm>` — not HUDs
- Drug inventory uses the same `<AppraisalForm>` as painting collection — same component, different data
- Neighborhood context is provided via React context, accent color flows from there

### Auction Type Visual Skins (from brief, locked)
| Type | Skin |
|------|------|
| Open | Preview night. Characters visible, raised hand animations. |
| Once Around | Formal dinner. Players in seats. Bids spoken in sequence. |
| Sealed Bid | Everyone on their phones. Reveal animation. |
| Fixed Price | Price tag on white wall. Gallery assistant standing nearby. |
| Double | Drop format. Dark background. Countdown timer. |

### Stack Decisions (from research)
- **framer-motion 12.38.0** (already installed) — use explicit enter/exit variants, NOT `layoutId` or `AnimateSharedLayout` (perf risk)
- **Tailwind v4** — use design tokens via `@theme` directive in CSS, not config file
- **CSS keyframes** for receipt/print effects and typewriter text (lighter than framer-motion for static animations)
- **No icon library** — use small caps text labels per the wall-label aesthetic

### Claude's Discretion
- Specific hex codes for the 5 accent colors (close to brief intent)
- Exact spacing/scale tokens
- Animation timing curves for auction skins
- Component naming conventions (within the established React patterns)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Visual Language Source
- `.planning/PROJECT.md` — Core Value, Aesthetic requirements (AEST-01 through AEST-11), Constraints
- `.planning/REQUIREMENTS.md` — AEST-01 through AEST-11 detailed requirements
- `.planning/research/SUMMARY.md` — Stack decisions for animation library, Tailwind approach
- `.planning/research/FEATURES.md` — Visual skin details for the 5 auction types

### Existing Codebase
- `src/index.css` — Current global styles (Tailwind v4 entry)
- `src/components/game/AuctionPanel.tsx` — Existing auction UI (will be reskinned)
- `src/components/game/PlayerHand.tsx` — Existing hand UI (uses framer-motion)
- `src/components/game/ArtCard.tsx` — Existing card UI
- `src/components/game/RoundEndModal.tsx` — Will become Receipt
- `src/components/game/GameOverModal.tsx` — Will use Receipt for leaderboard
- `tailwind.config.ts` or `vite.config.ts` — Tailwind v4 plugin config

</canonical_refs>

<specifics>
## Specific Ideas

- The `<WallLabel>` component should accept `title`, `medium`, `year`, `dimensions` props to mimic real gallery wall labels
- The `<Receipt>` component should render with monospace font, dotted-line separators, and a "PRINTED" rubber stamp effect
- Auction result receipt format example:
  ```
  ════════════════════════════
  AUCTION RESULT — ROUND 2
  ════════════════════════════
  LOT #14
  Yoko, "Untitled (Red), 2024"
  Sold to: Marta G. — $42,000
  ────────────────────────────
  ```
- The Online neighborhood should use a `font-family` that tries to load and falls back, intentionally — listing a non-existent font first

</specifics>

<deferred>
## Deferred Ideas

- Sound effects (deferred to v2 per PROJECT.md Out of Scope)
- Animated character avatars (not in brief, deferred)
- Custom illustration system (the aesthetic is text-first; no illustrations needed for v1)

</deferred>

---

*Phase: 02-aesthetic-system-foundation*
*Context gathered: 2026-04-06*

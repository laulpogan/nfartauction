---
phase: 02-aesthetic-system-foundation
plan: 03
subsystem: auction-skins
tags: [auction-skins, framer-motion, dispatcher, online-neighborhood, tdd]
one-liner: "Split AuctionPanel into five type-specific visual skins (preview night, formal dinner, phones grid, price tag, drop format) plus an OnlineNeighborhood wrapper that activates the broken-font + accent-flicker aesthetic for Phase 5."
dependency-graph:
  requires:
    - "Plan 02-01: tokens.css @theme palette, keyframes.css (online-accent-flicker + prefers-reduced-motion), NeighborhoodProvider"
    - "Plan 02-02: WallLabel primitive"
    - "Existing ArtCard, Button"
    - "framer-motion 12"
  provides:
    - "src/components/game/auction-skins/types.ts — AuctionSkinProps shared contract + formatMoney helper"
    - "src/components/game/auction-skins/OpenAuctionSkin.tsx — preview night skin"
    - "src/components/game/auction-skins/OnceAroundSkin.tsx — formal dinner skin"
    - "src/components/game/auction-skins/SealedBidSkin.tsx — phones grid skin with rotateX reveal"
    - "src/components/game/auction-skins/FixedPriceSkin.tsx — price tag swinging on white wall"
    - "src/components/game/auction-skins/DoubleSkin.tsx — dark-palette drop format (only skin with bg-ink override)"
    - "src/components/game/AuctionPanel.tsx — 42-line dispatcher that forwards to the matching skin inside AnimatePresence mode='wait'"
    - "src/components/aesthetic/OnlineNeighborhood.tsx — Phase 5 entry point for the broken-font/flicker aesthetic"
  affects:
    - "GameBoard.tsx AuctionPanel call site unchanged — the dispatcher's AuctionSkinProps is assignment-compatible with the previous AuctionPanelProps"
    - "Phase 5 NFT panel will import OnlineNeighborhood as the first live consumer of the Online accent aesthetic"
tech-stack:
  added: []
  patterns:
    - "Thin dispatcher over content-addressable variant components (switch on auction.auctionType)"
    - "AnimatePresence mode='wait' keyed on auction.id so mid-auction re-renders do not swap skins but distinct auctions remount cleanly"
    - "Explicit framer-motion variants for the SealedBidSkin phone grid (hidden → visible stagger → reveal rotateX) — NO layoutId per RESEARCH pitfall"
    - "framer-motion mocked with a Proxy-based motion passthrough in auction-skins.test.tsx so every motion.* tag works without per-tag stubs"
    - "Dark-palette override isolated to DoubleSkin using bg-ink + text-paper, with a DarkLabel helper because WallLabel hard-codes text-ink"
key-files:
  created:
    - "src/components/game/auction-skins/types.ts"
    - "src/components/game/auction-skins/OpenAuctionSkin.tsx"
    - "src/components/game/auction-skins/OnceAroundSkin.tsx"
    - "src/components/game/auction-skins/SealedBidSkin.tsx"
    - "src/components/game/auction-skins/FixedPriceSkin.tsx"
    - "src/components/game/auction-skins/DoubleSkin.tsx"
    - "src/components/game/auction-skins/auction-skins.test.tsx"
    - "src/components/aesthetic/OnlineNeighborhood.tsx"
    - "src/components/aesthetic/OnlineNeighborhood.test.tsx"
  modified:
    - "src/components/game/AuctionPanel.tsx"
decisions:
  - "AuctionPanel dispatcher keys AnimatePresence on auction.id (not auctionType). Mid-auction state changes do not unmount/remount the skin; distinct auctions still re-enter cleanly because their ids differ (matches threat T-2.3-05 mitigation)."
  - "DoubleSkin uses a local DarkLabel helper (raw uppercase span with text-paper) rather than WallLabel because WallLabel hard-codes text-ink. Documented as a known WallLabel limitation; a future plan may add a `tone` prop."
  - "SealedBidSkin only reads Object.keys(auction.sealedBids).length and auction.sealedBids[i] !== undefined. Bid amounts are never rendered — matches Phase 1 ENG-01 public projection which strips amounts."
  - "framer-motion mocked in auction-skins.test.tsx with a Proxy that returns a passthrough component for any motion.* tag, so new tags work without updating the mock. Framer-only props (initial/animate/exit/variants/etc.) are stripped to avoid React 'unknown DOM attribute' warnings."
  - "AuctionPanelProps kept as a named export (type alias for AuctionSkinProps) so GameBoard.tsx compiles unchanged."
metrics:
  duration: "~6 minutes"
  tasks_completed: 2
  tests_added: 13
  tests_total: 70
  files_created: 9
  files_modified: 1
  completed: "2026-04-06T21:54:30Z"
requirements: [AEST-06, AEST-07, AEST-08, AEST-09, AEST-10, AEST-11]
---

# Phase 02 Plan 03: Auction Skins + OnlineNeighborhood Summary

## One-liner

Phase 2's visible payoff: AuctionPanel is now a 42-line dispatcher that hands off to one of five self-contained visual skins keyed on `auction.auctionType`. A player can identify the auction type from the room aesthetic alone — preview-night wall cards, dinner-table seats, phones-on-the-table grid, a price tag swinging on a white wall, or a midnight drop on black. The OnlineNeighborhood wrapper ships alongside so Phase 5's NFT layer can drop the broken-font/flicker aesthetic in with a single component.

## Five Auction Skins

| Auction type | File | Aesthetic | Hero animation |
| ------------ | ---- | --------- | -------------- |
| `open`        | `src/components/game/auction-skins/OpenAuctionSkin.tsx` | Preview night. Accent-bordered paper panel. Players as small wall-label tiles. | Leading bidder tile performs a continuous `y: [-2, -8, -2]` "raised hand" pulse (1.6s loop). |
| `once_around` | `src/components/game/auction-skins/OnceAroundSkin.tsx` | Formal dinner. Seat row across the table. | Active seat springs to `scale: 1.05` with a 2px accent border. |
| `sealed_bid`  | `src/components/game/auction-skins/SealedBidSkin.tsx`  | Everyone on phones. `aspect-[9/16]` tile grid. | Staggered entry (`delay: i * 0.08`); when `submittedCount === players.length`, every tile animates to `rotateX: 180` over 0.6s — the reveal. |
| `fixed_price` | `src/components/game/auction-skins/FixedPriceSkin.tsx` | Price tag on a white wall. Gallery assistant indicator. | Tag swings in from `rotate: -15 → 0` spring (stiffness 200, damping 12). |
| `double`      | `src/components/game/auction-skins/DoubleSkin.tsx`      | Drop format. **Only skin with `bg-ink` dark palette override.** | "GOING…" label scale-pulses `[1, 1.1, 1]` on a 1s loop while awaiting the second card. |

Every skin is a `motion.div` with explicit `initial / animate / exit` variants — no `layoutId`, matching RESEARCH pitfall 3 and threat T-2.3-04 (DoS via animation).

## AuctionPanel Dispatcher

```tsx
export type AuctionPanelProps = AuctionSkinProps

export function AuctionPanel(props: AuctionPanelProps) {
  const { game } = props
  if (!game.auction) return null

  const skin = (() => {
    switch (game.auction.auctionType) {
      case 'open':        return <OpenAuctionSkin {...props} />
      case 'once_around': return <OnceAroundSkin {...props} />
      case 'sealed_bid':  return <SealedBidSkin {...props} />
      case 'fixed_price': return <FixedPriceSkin {...props} />
      case 'double':      return <DoubleSkin {...props} />
    }
  })()

  return (
    <AnimatePresence mode="wait">
      <div key={game.auction.id}>{skin}</div>
    </AnimatePresence>
  )
}
```

42 lines total. No per-type rendering blocks remain in `AuctionPanel.tsx` — all visual logic lives in the skin files. GameBoard.tsx compiles unchanged because `AuctionPanelProps = AuctionSkinProps` and the field list matches the existing GameBoard call site exactly.

## Shared Skin Contract

`src/components/game/auction-skins/types.ts`:

```ts
export interface AuctionSkinProps {
  game: GameState
  myPlayerIdx: number
  isAuctioneer: boolean
  myMoney: number
  onSetFixedPrice: (price: number) => void
  onAcceptFixedPrice: () => void
  onPassFixedPrice: () => void
  onPlaceOpenBid: (amount: number) => void
  onEndOpenAuction: () => void
  onPlaceOnceAroundBid: (amount: number | null) => void
  onSubmitSealedBid: (amount: number) => void
}

export function formatMoney(n: number): string
```

Also re-exported indirectly via `AuctionPanelProps`.

## OnlineNeighborhood

```tsx
import { OnlineNeighborhood } from '@/components/aesthetic/OnlineNeighborhood'

// Phase 5 NFT panel usage:
<OnlineNeighborhood>
  <div className="text-[var(--color-accent)]">
    NFT LAYER PREVIEW
  </div>
</OnlineNeighborhood>
```

The wrapper is a thin `NeighborhoodProvider neighborhood="online"` shim. The visual effects come entirely from Plan 01 infrastructure:

1. `NeighborhoodProvider` attaches `className="neighborhood-online"` when `neighborhood === 'online'`.
2. `tokens.css` defines `--font-broken: 'NonexistentFontXYZ123', 'Comic Sans MS', cursive` — the first name intentionally fails to load so the browser cascades "wrong".
3. `keyframes.css` targets `.neighborhood-online` with `font-family: var(--font-broken)` and the `online-accent-flicker` animation.
4. That same CSS block is wrapped in a `@media (prefers-reduced-motion: reduce)` guard that disables the flicker entirely for accessibility.
5. `useNeighborhood()` inside the subtree returns `{ neighborhood: 'online', accentVar: 'var(--color-online)' }`.

No new CSS in this plan. The wrapper ships with 5 locked tests and no live Phase 2 consumer — first consumer is the Phase 5 NFT panel mount (documented, not a stub).

## Known WallLabel Limitation (surfaced by DoubleSkin)

`WallLabel` hard-codes `text-ink` on both its free-form and structured variants:

```tsx
// src/components/aesthetic/WallLabel.tsx line 46
className={clsx('font-label uppercase tracking-[0.18em] text-ink', ...)}
```

`DoubleSkin` overrides the base palette to `bg-ink text-paper` (the only skin that does), which means any `<WallLabel>` inside would render invisible black-on-black. To work around this without touching the primitive, DoubleSkin defines a local `DarkLabel` helper that mirrors the WallLabel free-form render — same font-label + uppercase + tracking-[0.18em] classes — but with `text-paper`:

```tsx
function DarkLabel({ children, size = 'sm' }) {
  const sizeClass = size === 'lg' ? 'text-base' : size === 'md' ? 'text-sm' : 'text-xs'
  return (
    <span className={`font-label uppercase tracking-[0.18em] text-paper ${sizeClass}`}>
      {children}
    </span>
  )
}
```

**Recommended future change:** add a `tone?: 'ink' | 'paper'` prop to WallLabel so skins that invert the palette can use the primitive directly. Deferred to Phase 5 (first dark-palette consumer outside auctions) or a dedicated Phase 2 follow-up. Not urgent — DarkLabel is isolated to one skin.

## Test Coverage (13 new tests, 70 total)

| File | Tests | Behaviors locked |
| ---- | ----- | ---------------- |
| `auction-skins/auction-skins.test.tsx` | 8 | Each of the five skins renders with a representative `GameState` fixture; DoubleSkin DOM contains `bg-ink` (dark override gate); AuctionPanel dispatcher mounts SealedBidSkin for `auctionType='sealed_bid'`; AuctionPanel returns null when `auction === null`. |
| `aesthetic/OnlineNeighborhood.test.tsx` | 5 | Wrapper has className `neighborhood-online`; has `data-neighborhood="online"`; inline style contains `--color-accent` + `var(--color-online)`; children render; `useNeighborhood()` inside a child resolves to `{ neighborhood: 'online', accentVar: 'var(--color-online)' }`. |

All tests use the `@testing-library/react` pattern established in Plans 02-01 and 02-02. `auction-skins.test.tsx` introduces a Proxy-based framer-motion mock that returns a passthrough component for any `motion.*` tag and strips framer-only props so React doesn't emit unknown-attribute warnings.

**Suite totals:** `npx vitest run` → **8 test files, 70 passing** (36 engine + 5 context + 16 aesthetic primitives + 8 auction skins + 5 online neighborhood).
`npx tsc --noEmit` → **clean**.
Grep gate `🎨|🔨|🥇|🥈|🥉|🏆|⏱|◼|◻` against `src/components/game/auction-skins/*.tsx` → **zero matches**.

## Deviations from Plan

None. The plan executed exactly as written. Two clarifications applied during write:

- The fixture helper `makeFixture(auctionType)` in `auction-skins.test.tsx` exposes an `auctionOverrides` second arg so the Double test can set `status: 'waiting_second'` without duplicating the fixture. Plan implied a single fixture shape; this is strictly additive.
- `OpenAuctionSkin` disables its bid button when `myPlayerIdx === auction.auctioneerIdx` (the auctioneer should not bid on their own lot). This is a correctness invariant implied by the engine but not explicitly called out in the plan — Rule 2 (correctness), applied inline with no behavioral test since engine-level rejection already exists.

## Tasks Completed

| # | Task | Commit | Files |
| - | ---- | ------ | ----- |
| 1 | Five auction skins + slim AuctionPanel dispatcher + smoke tests | `08d723b` | `src/components/game/auction-skins/{types,OpenAuctionSkin,OnceAroundSkin,SealedBidSkin,FixedPriceSkin,DoubleSkin,auction-skins.test}.tsx` + `src/components/game/AuctionPanel.tsx` |
| 2 | OnlineNeighborhood wrapper + 5 locked tests                      | `f0baf51` | `src/components/aesthetic/OnlineNeighborhood.tsx` + `.test.tsx` |

## Manual Verification Checklist

(For the user to run before `/gsd-verify-work`.)

1. `npm run dev` boots on the existing localhost port.
2. Start a game and trigger each auction type in turn (via the existing card-play flow):
   - **Open** → white panel with accent border; player strip visible; when a bid is placed, the leading bidder's tile pulses up/down.
   - **Once Around** → dinner-table row; the active player's seat is scaled with a 2px accent border; bidding advances left-to-right.
   - **Sealed Bid** → 9:16 phone grid; tiles enter with a subtle stagger; after every player locks in, the whole grid flips via `rotateX: 180`.
   - **Fixed Price** → big centered price tag swings in from `-15°`; "GALLERY ASSISTANT: <auctioneer>" line underneath; Buy / Pass visible to the offered-to player.
   - **Double** → entire panel is on a dark ink background with paper-colored type (the ONLY dark screen in the app); "GOING…" label scale-pulses while waiting for the second card.
3. Mid-auction transitions do not visually overlap (AnimatePresence `mode='wait'` keyed on `auction.id`).
4. Visual sanity: another person looking over your shoulder who has never seen the code can call out which auction type is happening from the screen alone. This is the Phase 2 goal-test.
5. OnlineNeighborhood visual verification is **deferred to Phase 5** per the plan — no in-game consumer yet.

## Known Stubs

None. Every skin reads real `GameState` / `auction` fields and wires action props through to the GameBoard-provided callbacks. `OnlineNeighborhood` has no in-game consumer in Phase 2 by design — documented, tested, and locked for Phase 5.

## Success Criteria Delivered

- **AEST-06** — Open auction preview-night skin with raised-hand bidder pulse → `OpenAuctionSkin.tsx`.
- **AEST-07** — Once Around formal-dinner skin with seat-row active highlight → `OnceAroundSkin.tsx`.
- **AEST-08** — Sealed-bid phones grid with stagger entry + `rotateX: 180` reveal on allSubmitted → `SealedBidSkin.tsx`.
- **AEST-09** — Fixed-price tag swing on white wall + gallery assistant indicator → `FixedPriceSkin.tsx`.
- **AEST-10** — Double auction drop format with dark `bg-ink` override + countdown pulse → `DoubleSkin.tsx` (only skin that inverts the palette).
- **AEST-11** — Online neighborhood broken-font + flicker accent wrapper with `prefers-reduced-motion` guard → `OnlineNeighborhood.tsx` + Plan 01 keyframes.

## Self-Check: PASSED

Created files verified present:

- FOUND: `src/components/game/auction-skins/types.ts`
- FOUND: `src/components/game/auction-skins/OpenAuctionSkin.tsx`
- FOUND: `src/components/game/auction-skins/OnceAroundSkin.tsx`
- FOUND: `src/components/game/auction-skins/SealedBidSkin.tsx`
- FOUND: `src/components/game/auction-skins/FixedPriceSkin.tsx`
- FOUND: `src/components/game/auction-skins/DoubleSkin.tsx`
- FOUND: `src/components/game/auction-skins/auction-skins.test.tsx`
- FOUND: `src/components/aesthetic/OnlineNeighborhood.tsx`
- FOUND: `src/components/aesthetic/OnlineNeighborhood.test.tsx`

Commits verified present:

- FOUND: `08d723b` (Task 1)
- FOUND: `f0baf51` (Task 2)

Tests passing: 70/70. TypeScript: clean. Grep gates: zero matches.

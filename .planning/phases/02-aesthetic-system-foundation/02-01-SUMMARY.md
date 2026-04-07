---
phase: 02-aesthetic-system-foundation
plan: 01
subsystem: design-system
tags: [tailwind-v4, react-context, zine, palette, tokens, testing-infrastructure]
one-liner: "Zine palette foundation (paper/ink + 5 neighborhood accents) landed atomically across all UI with NeighborhoodContext wired and jsdom-based component testing bootstrapped."
dependency-graph:
  requires:
    - "Tailwind v4.2.2 installed via @tailwindcss/vite"
    - "React 19 + framer-motion 12"
    - "Existing game components (GameBoard, AuctionPanel, PlayerHand, RoundEndModal, GameOverModal)"
  provides:
    - "src/styles/tokens.css — @theme block with paper/ink/rule/stamp + 5 neighborhood accents + 3 font families"
    - "src/styles/keyframes.css — receipt-print / typewriter / online-accent-flicker + prefers-reduced-motion guards"
    - "src/contexts/NeighborhoodContext.tsx — NeighborhoodProvider, useNeighborhood, Neighborhood type"
    - "jsdom test environment + @testing-library/react for all future component tests"
    - "Canonical Tailwind v4 arbitrary-value syntax: bg-[var(--color-accent)] / text-[var(--color-accent)] / border-[var(--color-accent)]"
  affects:
    - "All future Phase 2 primitives (WallLabel, Receipt, AppraisalForm) consume these tokens"
    - "All future auction skin components (Plan 03) consume the --color-accent CSS variable"
    - "Phase 3 sim layer reads active neighborhood from NeighborhoodProvider context"
tech-stack:
  added:
    - "@testing-library/react ^17.x (devDependency)"
    - "@testing-library/jest-dom ^6.x (devDependency)"
    - "jsdom ^28.x (devDependency)"
  patterns:
    - "Tailwind v4 @theme directive in CSS (no tailwind.config.ts)"
    - "React Context + inline style CSS custom-property injection for per-subtree accent color"
    - "data-testid based RTL assertions on provider wrapper (no text coupling)"
    - "Zine palette: paper base, ink type, one accent per neighborhood, status via typography not hue"
key-files:
  created:
    - "src/styles/tokens.css"
    - "src/styles/keyframes.css"
    - "src/contexts/NeighborhoodContext.tsx"
    - "src/contexts/NeighborhoodContext.test.tsx"
  modified:
    - "vite.config.ts"
    - "package.json"
    - "package-lock.json"
    - "src/index.css"
    - "index.html"
    - "src/components/game/GameBoard.tsx"
    - "src/components/game/AuctionPanel.tsx"
    - "src/components/game/PlayerHand.tsx"
    - "src/components/game/RoundEndModal.tsx"
    - "src/components/game/GameOverModal.tsx"
    - "src/components/game/PlayerList.tsx"
    - "src/components/game/ArtistTracker.tsx"
    - "src/components/game/ArtCard.tsx"
    - "src/components/ui/Button.tsx"
    - "src/components/ui/Modal.tsx"
    - "src/components/lobby/Lobby.tsx"
    - "src/components/lobby/WaitingRoom.tsx"
    - "src/pages/GamePage.tsx"
decisions:
  - "Canonical Tailwind v4 arbitrary-value form is bg-[var(--color-accent)] (not bg-(--color-accent) shorthand) — universally supported across v4 minors; pin this for Plans 02 and 03."
  - "Atomic palette swap extended beyond the 5 plan-scoped files to all rendered UI (shared Button/Modal, lobby/waiting room, ArtCard/PlayerList/ArtistTracker, GamePage) to honor the CRITICAL 'no half-state' directive."
  - "ARTIST_COLORS export in src/types/game.ts is now dead code; left in place to avoid a type-level ripple. Deferred to a later cleanup pass."
  - "NeighborhoodProvider wraps GameBoard, WaitingRoom, Lobby, and GamePage loading/error states — every top-level rendered surface resolves --color-accent via context, not :root fallback."
metrics:
  duration: "~8 minutes"
  tasks_completed: 2
  tests_added: 5
  tests_total: 41
  files_created: 4
  files_modified: 19
  completed: "2026-04-07T04:42:30Z"
---

# Phase 02 Plan 01: Zine Palette Foundation Summary

## One-liner

Wave 0 atomic palette swap: the NFArt app stopped rendering on dark zinc and now renders on off-white `#fafaf7` paper with black ink type. Tailwind v4 `@theme` tokens are in place for the zine base palette (paper/ink/ink-soft/rule/stamp) and all five neighborhood accents (gallery/warehouse/flatlands/hotel/online). `NeighborhoodProvider` wraps every top-level surface with the hard-coded `gallery` neighborhood and exposes `--color-accent` as an inline CSS custom property on its subtree. Component testing is now jsdom + @testing-library/react, with five passing tests covering the provider contract.

## Tailwind v4 Arbitrary-Value Syntax (canonical for Phase 2)

```tsx
// USE THIS FORM everywhere --color-accent is consumed:
className="bg-[var(--color-accent)] text-[var(--color-accent)] border-[var(--color-accent)]"

// Fractional opacities work with the slash form:
className="bg-[var(--color-accent)]/10"
```

Verified working against installed Tailwind `4.2.2` (compile-time CSS generated, accent updates propagate through the cascade). The shorter `bg-(--color-accent)` shorthand exists but was skipped to avoid surprises across minor versions. Recorded at the top of `src/styles/tokens.css` as a comment for Plans 02 and 03.

## @theme Tokens (full table)

| Token | Value | Purpose |
|-------|-------|---------|
| `--color-paper` | `#fafaf7` | Base background, all panels, body |
| `--color-ink` | `#0a0a0a` | Primary type, borders at emphasis |
| `--color-ink-soft` | `#4a4a4a` | Secondary/metadata type |
| `--color-rule` | `#d4d4d0` | Hairline borders, dotted separators |
| `--color-stamp` | `#c1272d` | Rubber-stamp red (universal, not neighborhood) |
| `--color-gallery` | `#2e4b8b` | Cold institutional blue — Gallery District |
| `--color-warehouse` | `#d97706` | Brutalist amber — Warehouse Zone |
| `--color-flatlands` | `#b91c1c` | Harsh red — The Flatlands |
| `--color-hotel` | `#c8b88a` | Sterile beige — Hotel District |
| `--color-online` | `#0f766e` | Default Online accent (flickers via keyframes) |
| `--font-label` | `'Special Elite', 'IBM Plex Mono', ui-monospace, monospace` | Wall-label body type |
| `--font-receipt` | `'JetBrains Mono', ui-monospace, monospace` | Receipt + numeric type |
| `--font-broken` | `'NonexistentFontXYZ123', 'Comic Sans MS', cursive` | Online intentional fallback |
| `--tracking-label` | `0.18em` | Small caps / wall-label tracking |

`:root { --color-accent: var(--color-gallery); }` is the default fallback for surfaces outside any `NeighborhoodProvider`.

## NeighborhoodProvider API

```tsx
import { NeighborhoodProvider, useNeighborhood, type Neighborhood } from '@/contexts/NeighborhoodContext'

<NeighborhoodProvider neighborhood="gallery">
  {/* descendants see --color-accent: var(--color-gallery) */}
</NeighborhoodProvider>

const { neighborhood, accentVar } = useNeighborhood()
// neighborhood: 'gallery' | 'warehouse' | 'flatlands' | 'hotel' | 'online'
// accentVar: `var(--color-gallery)` etc.
```

Wrapping `<div>` carries:
- `data-testid="neighborhood-root"`
- `data-neighborhood={neighborhood}`
- Inline `style={{ '--color-accent': 'var(--color-${neighborhood})' }}`
- `className="neighborhood-online"` only when `neighborhood === 'online'` (activates the flicker keyframes and broken-font fallback)

Import path: `../../contexts/NeighborhoodContext` (relative from `src/components/**`).

## Palette-Swap Coverage

All five plan-scoped game components were rewritten in Task 2:

| File | Status |
|------|--------|
| `src/components/game/GameBoard.tsx` | Wrapped with `NeighborhoodProvider neighborhood="gallery"`; paper base; accent header; 1ST/2ND/3RD text rankings in history sidebar. |
| `src/components/game/AuctionPanel.tsx` | Paper panel with accent border; all inputs on paper/ink; "HAMMER DOWN — SOLD" text replaces 🔨; status differentiation via border color only. |
| `src/components/game/PlayerHand.tsx` | Paper/rule card, accent turn pill, no `animate-pulse`. |
| `src/components/game/RoundEndModal.tsx` | 1ST/2ND/3RD/4TH/5TH text ranks replace medal emojis; paper/rule rows. |
| `src/components/game/GameOverModal.tsx` | Text ranks; accent winner highlight; no 🏆/🎨 emojis. |

Grep gates verified zero matches in these files for:
- `bg-zinc-`, `text-zinc-`, `border-zinc-`, `text-white`, `bg-white`
- `text-amber-`, `text-green-`, `text-red-`, `text-indigo-`, `bg-amber-`, `bg-green-`, `bg-indigo-`
- `🎨`, `🔨`, `🥇`, `🥈`, `🥉`, `🏆`

## Deviations from Plan

### [Rule 2 — Correctness] Extended palette swap to shared UI + lobby + pages

- **Found during:** Task 2 verification
- **Issue:** The plan's `<files>` list for Task 2 only named the five game components, but they render `Button`, `Modal`, `PlayerList`, `ArtistTracker`, `ArtCard` which were still dark-zinc. `Lobby`, `WaitingRoom`, and `GamePage` loading/error states were also entirely dark-zinc. Shipping just the five files would have left the app in exactly the half-state the user's CRITICAL directive prohibits.
- **Fix:** Rewrote all of the above in the same commit as the game components. Button now has paper/accent/ink variants only; Modal is a paper panel with ink border; PlayerList/ArtistTracker/ArtCard use paper + rule borders + ink type; Lobby/WaitingRoom/GamePage wrap themselves with NeighborhoodProvider and render on paper.
- **Files modified (extra):** `src/components/ui/Button.tsx`, `src/components/ui/Modal.tsx`, `src/components/game/PlayerList.tsx`, `src/components/game/ArtistTracker.tsx`, `src/components/game/ArtCard.tsx`, `src/components/lobby/Lobby.tsx`, `src/components/lobby/WaitingRoom.tsx`, `src/pages/GamePage.tsx`
- **Commit:** `987e44c` (same atomic commit as the plan-scoped files)

### [Rule 1 — Bug] Removed dead `ARTIST_COLORS`/`colors` references in components

- **Found during:** Task 2 rewrites
- **Issue:** `AuctionPanel.tsx` had `const colors = ARTIST_COLORS[auction.cards[0]?.artist]` and `RoundEndModal.tsx` referenced `colors.bg` / `colors.text`. These coupled the game components to dark-theme class strings in `types/game.ts`.
- **Fix:** Dropped the `colors` references and the `ARTIST_COLORS` import from both components. Status differentiation is now purely typographic per Pattern 6.
- **Files modified:** `src/components/game/AuctionPanel.tsx`, `src/components/game/RoundEndModal.tsx`
- **Commit:** `987e44c`

### Deferred Issues

**`src/types/game.ts` ARTIST_COLORS export is dead code.** The table still contains `bg-violet-950`, `bg-amber-950`, etc. No component consumes it after this plan, so it does not affect the rendered UI. Left in place to avoid a type-level ripple. A future cleanup plan (or Plan 03 when defining per-artist skins) should either delete it or re-key it to the zine palette.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Test infrastructure + token foundation + context | `0153dd3` | `vite.config.ts`, `package.json`, `src/styles/tokens.css`, `src/styles/keyframes.css`, `src/index.css`, `index.html`, `src/contexts/NeighborhoodContext.tsx`, `src/contexts/NeighborhoodContext.test.tsx` |
| 2 | Atomic palette swap across all UI | `987e44c` | GameBoard, AuctionPanel, PlayerHand, RoundEndModal, GameOverModal, PlayerList, ArtistTracker, ArtCard, Button, Modal, Lobby, WaitingRoom, GamePage |

## Verification

- `npx vitest run` → 3 test files, **41/41 tests passing** (36 Phase 1 engine tests + 5 new NeighborhoodContext tests).
- `npx tsc --noEmit` → **clean** (no type regressions).
- Grep gates in plan Task 2 `<done>` block: **all zero matches** for dark zinc / rainbow / emoji classes across the five plan-scoped files.
- No file in `src/components/**` or `src/pages/**` still contains dark-zinc/amber/green/indigo utility classes (verified via wide grep).

## Self-Check: PASSED

Created files verified present:
- FOUND: `src/styles/tokens.css`
- FOUND: `src/styles/keyframes.css`
- FOUND: `src/contexts/NeighborhoodContext.tsx`
- FOUND: `src/contexts/NeighborhoodContext.test.tsx`

Commits verified present:
- FOUND: `0153dd3` (Task 1)
- FOUND: `987e44c` (Task 2)

Tests passing: 41/41. TypeScript: clean.

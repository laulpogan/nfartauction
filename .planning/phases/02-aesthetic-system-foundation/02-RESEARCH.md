# Phase 2: Aesthetic System Foundation - Research

**Researched:** 2026-04-06
**Domain:** Design system / component aesthetics (Tailwind v4 tokens, React context, framer-motion variants, CSS print/glitch effects)
**Confidence:** HIGH

## Summary

Phase 2 establishes the zine visual language for NFArt. The aesthetic must be **baked into shared components from the start**, not retrofitted. The work decomposes cleanly into four orthogonal layers: (1) Tailwind v4 design tokens via the `@theme` directive in `src/index.css`, (2) a React Context that provides the active neighborhood and exposes its accent color via CSS custom properties, (3) three primitive aesthetic components (`WallLabel`, `Receipt`, `AppraisalForm`) that every downstream phase consumes, and (4) five auction-type visual skin variants that re-skin the existing `AuctionPanel` without changing its props/behavior.

The existing codebase has the right bones — `AuctionPanel.tsx`, `RoundEndModal.tsx`, and `GameBoard.tsx` already render all five auction states with framer-motion. The phase 2 work is **a controlled rewrite of these three files plus a wholesale rewrite of `index.css`** — not a refactor, not new components added alongside. The current dark zinc palette must be replaced wholesale with the white-base zine palette; mixing palettes mid-migration leaves the game in a broken half-state.

**Primary recommendation:** Build the four layers in this order — tokens → context → primitives → re-skin existing components. Do not introduce new components for sim/depth/NFT phases. Wave 0 must replace `index.css` and the body background in one atomic commit so the dark theme never coexists with the new tokens.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Visual Language (locked from PROJECT.md brief)**
- Base palette: White background, black type, ONE accent color visible at any time
- No multi-color schemes — accent shifts by neighborhood context
- Negative space is excessive by design — not a refinement
- Typography: Small caps headers, dry wall-label copy for everything

**Neighborhood Accent Colors (locked from brief)**
- Gallery District: cold institutional blue
- Warehouse Zone: brutalist amber
- The Flatlands: harsh red
- Hotel District: sterile beige
- Online (NFT layer): same UI but fonts load wrong, accent color flickers on randomized interval

**Component Architecture**
- All copy goes through a `<WallLabel>` component — never raw text
- All auction outcomes render as `<Receipt>` — not modal cards
- All stat displays render as `<AppraisalForm>` — not HUDs
- Drug inventory uses the same `<AppraisalForm>` as painting collection — same component, different data
- Neighborhood context is provided via React context, accent color flows from there

**Auction Type Visual Skins**
| Type | Skin |
|------|------|
| Open | Preview night. Characters visible, raised hand animations. |
| Once Around | Formal dinner. Players in seats. Bids spoken in sequence. |
| Sealed Bid | Everyone on their phones. Reveal animation. |
| Fixed Price | Price tag on white wall. Gallery assistant standing nearby. |
| Double | Drop format. Dark background. Countdown timer. |

**Stack Decisions (from research)**
- framer-motion 12.38.0 (already installed) — explicit enter/exit variants, NOT `layoutId` or `AnimateSharedLayout` (perf risk)
- Tailwind v4 — design tokens via `@theme` directive in CSS, not config file
- CSS keyframes for receipt/print effects and typewriter text (lighter than framer-motion for static animations)
- No icon library — use small caps text labels per the wall-label aesthetic

### Claude's Discretion
- Specific hex codes for the 5 accent colors (close to brief intent)
- Exact spacing/scale tokens
- Animation timing curves for auction skins
- Component naming conventions (within the established React patterns)

### Deferred Ideas (OUT OF SCOPE)
- Sound effects (deferred to v2 per PROJECT.md Out of Scope)
- Animated character avatars (not in brief, deferred)
- Custom illustration system (the aesthetic is text-first; no illustrations needed for v1)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AEST-01 | Zine visual language: white base, black type, single accent per neighborhood | `@theme` tokens (Standard Stack §1), neighborhood context (Pattern 2) |
| AEST-02 | Five neighborhood accent colors as design token system | Token table (Standard Stack §1), context-driven CSS var swap (Pattern 2) |
| AEST-03 | Wall-label typography component renders all game copy uniformly | `<WallLabel>` primitive (Pattern 3), small caps + dry copy CSS (Pattern 6) |
| AEST-04 | Auction results render as printed receipt | `<Receipt>` primitive (Pattern 4), CSS print aesthetic (Pattern 7) |
| AEST-05 | Player stats display as appraisal form | `<AppraisalForm>` primitive (Pattern 5) |
| AEST-06 | Open auction skin: preview night, raised hands | framer-motion variant per skin (Pattern 8), `OpenAuctionSkin` |
| AEST-07 | Once Around skin: formal dinner, sequential bids | `OnceAroundSkin` variant (Pattern 8) |
| AEST-08 | Sealed bid skin: phones + reveal animation | `SealedBidSkin` variant w/ reveal (Pattern 8) |
| AEST-09 | Fixed price skin: price tag on white wall | `FixedPriceSkin` variant (Pattern 8) |
| AEST-10 | Double auction skin: drop format, dark bg, countdown | `DoubleSkin` variant — only skin that overrides base palette (Pattern 8) |
| AEST-11 | Online neighborhood: broken font + flickering accent | Bad-font fallback technique (Pattern 9), CSS flicker keyframes (Pattern 10) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 4.2.2 (installed) | Design tokens via `@theme` directive in `src/index.css` | Locked stack; v4 explicitly moves tokens out of JS config into CSS [VERIFIED: package.json + tailwindcss.com/docs/theme] |
| framer-motion | 12.38.0 (installed) | Auction skin enter/exit variants, AnimatePresence for skin swap, sealed-bid reveal | Locked stack; already used in 4 components [VERIFIED: package.json] |
| clsx | 2.x (installed) | Conditional class composition (already pervasive in codebase) | Locked stack; matches existing convention [VERIFIED: AuctionPanel.tsx imports it] |
| React 19 Context | builtin | Provide active neighborhood + accent color to all descendants | Standard React; no new dependency [CITED: react.dev/reference/react/createContext] |
| CSS `@keyframes` | builtin | Receipt print, typewriter, flicker, font-glitch (cheaper than framer-motion for static loops) | Recommended in STACK.md [CITED: .planning/research/STACK.md] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@font-face` (CSS) | builtin | Load monospace receipt font + small-caps display font from Google Fonts CDN | Once in `src/index.css` |
| Google Fonts (CDN link) | n/a | Source for `JetBrains Mono` (receipt) and a small-caps display face (e.g. `IBM Plex Mono`, `Special Elite`) | Loaded via `<link>` in `index.html` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@theme` CSS tokens | `tailwind.config.ts` | v4 deprecates JS config in favor of `@theme` — using JS config fights the framework |
| React Context for accent | Tailwind variant per neighborhood (e.g. `gallery:bg-blue-500`) | Variant approach forces every component to know all neighborhoods; context flows naturally and supports the runtime "flicker" requirement on Online |
| framer-motion for receipt print | CSS clip-path keyframes | CSS is lighter, runs on compositor thread, no JS scheduling cost — STACK.md explicitly recommends CSS for this |
| Separate skin components | One `AuctionPanel` with conditional skin sub-components | Already what the existing file does — extending that pattern preserves prop contracts |

**Installation:**
```bash
# No npm installs required for Phase 2 — all dependencies present.
# Add font CDN link in index.html:
# <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Special+Elite&display=swap" rel="stylesheet">
```

**Version verification:** No new packages. Existing versions confirmed against `/Users/laul_pogan/Source/nfartauction/app/package.json` references in `.planning/codebase/CONVENTIONS.md` (line 124) and `.planning/research/STACK.md`. [VERIFIED: codebase + STACK.md]

## Architecture Patterns

### Recommended Project Structure
```
src/
├── index.css                          # @theme tokens + base body styles + CSS keyframes
├── styles/
│   ├── tokens.css                     # @theme block (imported from index.css)
│   ├── keyframes.css                  # @keyframes print, typewriter, flicker, glitch
│   └── base.css                       # body, scrollbar, default font stack
├── contexts/
│   └── NeighborhoodContext.tsx        # NEW: Provider + useNeighborhood hook
├── components/
│   ├── aesthetic/                     # NEW directory for primitives
│   │   ├── WallLabel.tsx              # Gallery wall label typography component
│   │   ├── Receipt.tsx                # Printed receipt container
│   │   ├── AppraisalForm.tsx          # Stat/inventory display form
│   │   └── NeighborhoodFrame.tsx      # Wraps a region with NeighborhoodProvider
│   └── game/
│       ├── AuctionPanel.tsx           # REWRITTEN: dispatches to skin sub-components
│       ├── auction-skins/             # NEW: one file per skin
│       │   ├── OpenAuctionSkin.tsx
│       │   ├── OnceAroundSkin.tsx
│       │   ├── SealedBidSkin.tsx
│       │   ├── FixedPriceSkin.tsx
│       │   └── DoubleSkin.tsx
│       ├── GameBoard.tsx              # REWRITTEN: white shell, header in WallLabel
│       └── RoundEndModal.tsx          # REPLACED by Receipt usage
```

### Pattern 1: Tailwind v4 `@theme` Tokens

The token system uses CSS custom properties with namespaced prefixes that auto-generate utilities. The accent color is **NOT** a Tailwind color — it is a single CSS variable `--color-accent` that gets reassigned by the neighborhood context. Tokens defined in `@theme` generate utility classes; tokens defined in `:root` do not generate classes but can still be referenced via `var()` or arbitrary values like `bg-[--color-accent]`.

```css
/* src/styles/tokens.css */
@import "tailwindcss";

@theme {
  /* Base palette — these generate utilities like bg-paper, text-ink */
  --color-paper: #fafaf7;        /* off-white, NOT pure #fff (less harsh) */
  --color-ink: #0a0a0a;          /* near-black */
  --color-ink-soft: #4a4a4a;     /* secondary text */
  --color-rule: #d4d4d0;         /* hairline borders, dotted separators */
  --color-stamp: #c1272d;        /* "PRINTED" rubber stamp red — universal, not neighborhood */

  /* Neighborhood accent palette — referenced by NeighborhoodContext */
  --color-gallery: #2e4b8b;      /* cold institutional blue */
  --color-warehouse: #d97706;    /* brutalist amber */
  --color-flatlands: #b91c1c;    /* harsh red */
  --color-hotel: #c8b88a;        /* sterile beige */
  --color-online: #0f766e;       /* default Online accent — flickers via CSS animation */

  /* Typography */
  --font-label: 'Special Elite', 'IBM Plex Mono', ui-monospace, monospace;
  --font-receipt: 'JetBrains Mono', ui-monospace, monospace;
  --font-broken: 'NonexistentFont', 'Comic Sans MS', cursive;  /* Online intentional fallback */

  /* Scale — generous negative space per brief */
  --spacing-label: 0.25rem;
  --spacing-section: 4rem;       /* very generous, "excessive by design" */

  /* Letter-spacing for small caps */
  --tracking-label: 0.18em;
}

/* Active accent — set by JS via NeighborhoodContext, defaults to gallery */
:root {
  --color-accent: var(--color-gallery);
}
```

This generates utilities: `bg-paper`, `text-ink`, `text-ink-soft`, `border-rule`, `font-label`, `font-receipt`, `font-broken`, etc. The active accent is consumed via arbitrary value: `bg-[--color-accent]`, `text-[--color-accent]`, `border-[--color-accent]`. [VERIFIED: tailwindcss.com/docs/theme]

### Pattern 2: NeighborhoodContext + CSS Variable Swap

The accent color flows via React Context and is materialized as a CSS custom property on the wrapping `<div>`. This means a single descendant DOM region can have a different accent than its siblings — critical for sim phases where the player travels between neighborhoods.

```typescript
// src/contexts/NeighborhoodContext.tsx
import { createContext, useContext, type ReactNode } from 'react'

export type Neighborhood = 'gallery' | 'warehouse' | 'flatlands' | 'hotel' | 'online'

interface NeighborhoodContextValue {
  neighborhood: Neighborhood
  accentVar: string  // e.g. 'var(--color-gallery)'
}

const NeighborhoodContext = createContext<NeighborhoodContextValue>({
  neighborhood: 'gallery',
  accentVar: 'var(--color-gallery)',
})

export function useNeighborhood() {
  return useContext(NeighborhoodContext)
}

interface NeighborhoodProviderProps {
  neighborhood: Neighborhood
  children: ReactNode
}

export function NeighborhoodProvider({ neighborhood, children }: NeighborhoodProviderProps) {
  const accentVar = `var(--color-${neighborhood})`
  return (
    <NeighborhoodContext.Provider value={{ neighborhood, accentVar }}>
      <div
        data-neighborhood={neighborhood}
        style={{ '--color-accent': accentVar } as React.CSSProperties}
        className={neighborhood === 'online' ? 'neighborhood-online' : undefined}
      >
        {children}
      </div>
    </NeighborhoodContext.Provider>
  )
}
```

The `style` prop sets `--color-accent` only on this subtree — child components reference it as `bg-[--color-accent]` or `text-[--color-accent]` and automatically pick up the right color. The `data-neighborhood` attribute exists for CSS-only styling hooks; the `neighborhood-online` class triggers the broken-font + flicker behavior. [CITED: react.dev/reference/react/createContext, MDN CSS custom properties cascade]

**Why this pattern beats Tailwind variants:** A `gallery:bg-blue-500` style approach forces every leaf component to know the full neighborhood enum and all five colors. With CSS-var swap, leaves only know `bg-[--color-accent]` and the accent flows from the nearest parent.

### Pattern 3: `<WallLabel>` Primitive

The wall-label component renders gallery-label-style typography with optional metadata fields mimicking real wall labels. It accepts both a structured form (title/medium/year/dimensions) and a free-form variant for inline use.

```typescript
// src/components/aesthetic/WallLabel.tsx
import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface WallLabelProps {
  title?: string
  artist?: string
  medium?: string
  year?: string | number
  dimensions?: string
  children?: ReactNode  // For free-form inline labels
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function WallLabel({
  title, artist, medium, year, dimensions, children, size = 'md', className,
}: WallLabelProps) {
  const sizeClass = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' }[size]

  if (children) {
    return (
      <span className={clsx(
        'font-label uppercase tracking-[0.18em] text-ink',
        sizeClass,
        className,
      )}>
        {children}
      </span>
    )
  }

  return (
    <div className={clsx('font-label text-ink leading-relaxed', sizeClass, className)}>
      {artist && (
        <div className="uppercase tracking-[0.18em] font-bold">{artist}</div>
      )}
      {title && (
        <div className="italic">{title}{year && `, ${year}`}</div>
      )}
      {medium && <div className="text-ink-soft">{medium}</div>}
      {dimensions && <div className="text-ink-soft text-xs">{dimensions}</div>}
    </div>
  )
}
```

**Usage examples:**
- Auction header: `<WallLabel artist="YOKO" title="Untitled (Red)" year={2024} medium="Oil on canvas" />`
- Inline status: `<WallLabel size="sm">SOLD — $42,000</WallLabel>`
- Stat row: `<WallLabel size="sm">RESTEDNESS · 4/10</WallLabel>`

### Pattern 4: `<Receipt>` Primitive

The receipt component is a vertical container with monospace font, dotted-line separators, and a `print` enter animation. It accepts structured rows or free children.

```typescript
// src/components/aesthetic/Receipt.tsx
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface ReceiptProps {
  header?: string
  subheader?: string
  children: ReactNode
  stamped?: boolean         // Shows "PRINTED" rubber stamp overlay
  className?: string
}

export function Receipt({ header, subheader, children, stamped, className }: ReceiptProps) {
  return (
    <motion.div
      className={clsx(
        'relative bg-paper text-ink font-receipt p-6 max-w-md mx-auto',
        'border border-rule shadow-[0_2px_0_rgba(0,0,0,0.06)]',
        'receipt-print',  // CSS keyframe class
        className,
      )}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
    >
      {header && (
        <>
          <div className="text-center text-xs uppercase tracking-[0.2em] font-bold">
            {'═'.repeat(28)}
          </div>
          <div className="text-center text-sm font-bold uppercase tracking-[0.15em] my-1">
            {header}
          </div>
          {subheader && (
            <div className="text-center text-xs uppercase tracking-[0.15em] text-ink-soft mb-1">
              {subheader}
            </div>
          )}
          <div className="text-center text-xs">{'═'.repeat(28)}</div>
        </>
      )}
      <div className="my-3 text-sm leading-relaxed">{children}</div>
      <div className="text-center text-xs text-ink-soft">{'─'.repeat(28)}</div>
      {stamped && (
        <div className="absolute top-4 right-4 -rotate-12 border-2 border-stamp px-2 py-0.5 text-stamp text-xs font-bold uppercase tracking-widest opacity-70">
          Printed
        </div>
      )}
    </motion.div>
  )
}

// Helper for receipt row
export function ReceiptRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="uppercase text-xs tracking-[0.1em] text-ink-soft">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  )
}
```

The CSS print effect is a `clip-path` reveal in `keyframes.css`:
```css
@keyframes receipt-print {
  from { clip-path: inset(0 0 100% 0); }
  to   { clip-path: inset(0 0 0 0); }
}
.receipt-print { animation: receipt-print 600ms cubic-bezier(0.2, 0.8, 0.2, 1); }
```

### Pattern 5: `<AppraisalForm>` Primitive

The appraisal form is a two-column key/value table with monospace alignment, gallery-label header, and dotted-row separators. It accepts a `rows` array so the same component renders both painting collections (Phase 5) and drug inventories (Phase 4) — same component, different data per the locked decision.

```typescript
// src/components/aesthetic/AppraisalForm.tsx
import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface AppraisalRow {
  label: string
  value: ReactNode
  emphasis?: boolean
}

interface AppraisalFormProps {
  title: string
  formNumber?: string  // e.g. "FORM A-14"
  rows: AppraisalRow[]
  footer?: ReactNode
  className?: string
}

export function AppraisalForm({ title, formNumber, rows, footer, className }: AppraisalFormProps) {
  return (
    <div className={clsx('bg-paper text-ink font-label border border-rule p-5', className)}>
      <div className="flex justify-between items-baseline border-b border-ink pb-2 mb-3">
        <h3 className="uppercase tracking-[0.2em] text-sm font-bold">{title}</h3>
        {formNumber && (
          <span className="text-xs uppercase tracking-[0.15em] text-ink-soft">{formNumber}</span>
        )}
      </div>
      <dl className="space-y-1.5">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-baseline gap-2 border-b border-dashed border-rule pb-1"
          >
            <dt className="uppercase tracking-[0.12em] text-xs text-ink-soft min-w-[8rem]">
              {row.label}
            </dt>
            <dd className={clsx(
              'flex-1 text-right',
              row.emphasis ? 'font-bold text-base' : 'text-sm',
            )}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {footer && <div className="mt-3 pt-3 border-t border-ink text-xs text-ink-soft">{footer}</div>}
    </div>
  )
}
```

### Pattern 6: Wall-Label Typography Conventions

Real museum wall labels follow strict conventions Phase 2 mimics:
- **Artist name:** ALL CAPS, bold, slightly tracked (`uppercase tracking-[0.18em] font-bold`)
- **Title:** Title case in italics, year follows after comma (`italic`)
- **Medium:** sentence case, secondary color (`text-ink-soft`)
- **Dimensions:** smallest text, often metric (`text-xs text-ink-soft`)
- **Copy register:** declarative, no exclamation, no second person, no "you", no marketing voice. "SOLD TO MARTA G. — $42,000" not "Marta G. won the auction!"

This is encoded in `<WallLabel>` defaults — but downstream phases must also write copy in this register. Add a Wave 0 task: replace ALL existing copy strings in `AuctionPanel`, `GameBoard`, `PlayerHand`, `RoundEndModal`, `GameOverModal` with wall-label copy. No emoji (the "🎨" in `GameBoard.tsx` line 91 must go), no "Your turn!", no "Hammer Down — Sold!". [CITED: Museum wall label style guides — Smithsonian, MoMA published guidelines, common practice]

### Pattern 7: Receipt / Print Aesthetic CSS

The receipt aesthetic uses several CSS techniques; pure CSS keyframes per STACK.md.

```css
/* src/styles/keyframes.css */

/* Receipt vertical print reveal */
@keyframes receipt-print {
  from { clip-path: inset(0 0 100% 0); }
  to   { clip-path: inset(0 0 0 0); }
}

/* Typewriter character reveal — character-by-character via steps() */
@keyframes typewriter {
  from { width: 0; }
  to   { width: 100%; }
}
.typewriter {
  display: inline-block;
  overflow: hidden;
  white-space: nowrap;
  border-right: 2px solid currentColor;
  animation:
    typewriter 2s steps(40, end),
    blink-caret 0.75s step-end infinite;
}
@keyframes blink-caret {
  from, to { border-color: transparent; }
  50% { border-color: currentColor; }
}

/* Dotted-line separator for receipts (alternative to '─' chars) */
.dotted-rule {
  border-top: 1px dashed var(--color-rule);
}
```

**Rubber stamp:** The "PRINTED" stamp uses `border: 2px solid var(--color-stamp)`, a slight rotate via `transform: rotate(-12deg)`, and `opacity: 0.7` for the worn effect. Avoid trying to make it look photoreal — the zine aesthetic embraces obvious construction.

### Pattern 8: framer-motion Auction Skin Variants

Each of the five skin sub-components is a wrapping `<motion.div>` with skin-specific enter/exit variants. `AnimatePresence` swaps between them when `auction.auctionType` changes. **No `layoutId`** — explicit variants only.

```typescript
// src/components/game/auction-skins/SealedBidSkin.tsx
import { motion, AnimatePresence } from 'framer-motion'
import type { GameState } from '../../../types/game'

const phoneVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08 }
  }),
  reveal: { rotateX: 180, transition: { duration: 0.6 } },
}

interface Props {
  game: GameState
  myPlayerIdx: number
  onSubmitSealedBid: (amount: number) => void
  // ... other auction props
}

export function SealedBidSkin({ game, myPlayerIdx }: Props) {
  const auction = game.auction!
  const allSubmitted = Object.keys(auction.sealedBids).length === game.players.length

  return (
    <motion.div
      className="bg-paper text-ink p-section"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <WallLabel size="lg">SEALED BID — EVERYONE ON PHONES</WallLabel>
      <div className="grid grid-cols-3 gap-4 mt-8">
        <AnimatePresence>
          {game.players.map((p, i) => (
            <motion.div
              key={p.id}
              custom={i}
              variants={phoneVariants}
              initial="hidden"
              animate={allSubmitted ? 'reveal' : 'visible'}
              className="aspect-[9/16] border border-ink p-3"
            >
              <WallLabel size="sm">{p.displayName.toUpperCase()}</WallLabel>
              <div className="mt-auto text-ink-soft text-xs">
                {auction.sealedBids[i] !== undefined ? '◼ LOCKED' : '◻ TYPING'}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {/* ... bid input ... */}
    </motion.div>
  )
}
```

**Variant catalog (per skin):**

| Skin | Enter | Idle / interaction | Exit | Notes |
|------|-------|--------------------|------|-------|
| Open (preview night) | Fade-in, characters slide up staggered | Hand-raise: `y: -8` pulse on bid | Fade out | Each player rendered as a small card; raised-hand = motion pulse |
| Once Around (formal dinner) | Fade-in seat ring | Active seat: scale 1.05 + accent border | Fade out | Players in a row mimicking dinner table |
| Sealed Bid (phones) | Stagger phone tiles | Reveal: rotateX 180° flip on `allSubmitted` | Fade out | All-phones tile grid |
| Fixed Price (price tag) | Price tag swings in: `rotate: [-15, 0]` spring | Static | Slide down | Single large price tag centered on white |
| Double (drop format) | Background fade-to-black + countdown number scale-in | Countdown pulse per second | Fade to white | Only skin that overrides palette |

**Critical:** Use `AnimatePresence mode="wait"` when swapping skins so the outgoing skin finishes before the next mounts. [VERIFIED: motion.dev/docs/react-animate-presence]

### Pattern 9: "Intentionally Broken" Font Loading on Online

The Online neighborhood lists a non-existent font as the primary family in its font-stack. The browser tries to load it, fails, falls back to the secondary — but the loading attempt is intentionally visible because the secondary is jarringly different from the rest of the UI.

```css
/* src/styles/tokens.css */
@theme {
  --font-broken: 'NonexistentFontXYZ123', 'Comic Sans MS', cursive;
}

/* The Online neighborhood gets broken font everywhere */
.neighborhood-online {
  font-family: var(--font-broken);
}

/* Reset accent to Online color and start flicker */
.neighborhood-online {
  --color-accent: var(--color-online);
  animation: online-accent-flicker 7s steps(1, end) infinite;
}
```

**Why this works:** `'NonexistentFontXYZ123'` cannot resolve. Browser falls through to `Comic Sans MS` (universally installed on Windows/Mac, deeply jarring next to monospace). On Linux it falls through to generic `cursive`. Either way the result is wrong-feeling. The `font-display: swap` behavior of the surrounding fonts means there is also a brief FOIT/FOUT during page load that reinforces the "things are not loading right" feeling.

**Caveat:** Browsers do NOT make a network request for unknown family names — they just check the local font cache. So this is zero-cost performance-wise; it is purely a visual gag. [VERIFIED: MDN font-family resolution algorithm; CSS Fonts Module Level 4]

### Pattern 10: Online Accent Flicker

The flicker uses CSS keyframes with `steps(1, end)` for hard cuts (not smooth transitions). The randomized interval is faked by chaining several keyframe stops at irregular percentages.

```css
@keyframes online-accent-flicker {
  0%, 12%, 13%, 47%, 48%, 71%, 72%, 100% { --color-accent: var(--color-online); }
  12.5%      { --color-accent: var(--color-flatlands); }
  47.5%      { --color-accent: var(--color-warehouse); }
  71.5%      { --color-accent: var(--color-gallery); }
}
```

The irregular stops (`12%`, `47%`, `71%`) feel non-periodic to a viewer over a 7-second cycle. To avoid epilepsy concerns, the flicker is **slow** (7s cycle, 0.5% pulse width = ~35ms flash) and only swaps to other neighborhood colors, never to white/black. This satisfies WCAG 2.3.1 (no more than 3 flashes per second).

**Animating CSS custom properties** requires `@property` registration in modern browsers for interpolation, but **for `steps()` discrete swaps** it works without registration. [VERIFIED: caniuse.com/css-at-property; CSS Houdini Properties and Values API spec]

### Anti-Patterns to Avoid

- **`layoutId` for skin transitions:** STACK.md and CONTEXT.md both flag this. Use explicit `initial`/`animate`/`exit` variants.
- **Tailwind variants per neighborhood (`gallery:bg-blue-500`):** Forces every leaf to know the full enum. Use `bg-[--color-accent]` + context.
- **Inline raw text in components:** Every visible string must go through `<WallLabel>` (or be inside a `<Receipt>`/`<AppraisalForm>` which already use label fonts).
- **Pure white `#ffffff` background:** Use `#fafaf7` (`paper`). Pure white feels clinical and harsh on screens; off-white reads as "paper" without sacrificing the white-base directive.
- **Multi-color UI accents:** Only ONE color visible at a time. No "amber for warning + green for success" patterns. Status differentiation comes from typography (uppercase/italic) and position, not hue.
- **Emoji in copy:** "🎨", "🔨", "🥇" must be removed. Replace with WallLabel text.
- **Mixing dark zinc theme with new tokens:** Wave 0 must replace `index.css` body background and remove `bg-zinc-950` from `GameBoard.tsx` in the same commit. No half-state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color palette swapping per region | Manual prop-drilling of color hex values | React Context + `--color-accent` CSS var | Context flows automatically, CSS var means leaves don't subscribe to React state |
| Receipt print animation | JS-driven `setInterval` clip-path updates | CSS `@keyframes` with `clip-path` | GPU compositor thread, no JS scheduling, 60fps free |
| Typewriter text | Per-character `setTimeout` chain | CSS `@keyframes` with `steps()` and `width` | Same — GPU, no React re-renders per character |
| Font loading detection | `document.fonts.ready` Promises | Native CSS `font-family` fallback chain | Browser already handles fallback; explicit "broken" first family is the entire mechanism |
| Auction skin transitions | Manual mount/unmount with timeouts | framer-motion `<AnimatePresence mode="wait">` | Already installed; handles enter/exit timing correctly |
| Small caps headers | `text-transform: uppercase` + custom letter-spacing every time | `<WallLabel>` primitive | Single source of typographic truth; copy register enforced |
| Stat HUD layout | New flexbox grid per stat panel | `<AppraisalForm>` with rows array | Phase 4 drug inventory and Phase 5 painting collection use the same component; locked decision |

**Key insight:** This phase's leverage is in the FOUR primitives (`WallLabel`, `Receipt`, `AppraisalForm`, `NeighborhoodProvider`). Every downstream phase consumes them. Building them once, correctly, with permissive APIs is worth more than any single skin polish.

## Common Pitfalls

### Pitfall 1: CSS variable inheritance does not interpolate
**What goes wrong:** Animating `--color-accent` smoothly between two colors via `transition: --color-accent 300ms` does nothing — the variable changes but the transition doesn't apply.
**Why it happens:** CSS custom properties default to `<custom-ident>` type, which is non-animatable.
**How to avoid:** Either use `@property --color-accent { syntax: '<color>'; inherits: true; initial-value: #2e4b8b; }` to register the type (Chrome/Firefox/Safari 16.4+), OR use `steps()` discrete keyframes (no interpolation needed). The Online flicker uses the discrete approach.
**Warning signs:** Setting `--color-accent` via `style` works for instant swaps but appears "instant" instead of fading.

### Pitfall 2: `font-family: 'BrokenFont'` falls through silently
**What goes wrong:** You expect a visible "broken" effect but the browser fell through to the secondary so cleanly the gag is invisible.
**Why it happens:** The fallback chain is doing its job. If the secondary is too similar to the primary intended font, you get nothing.
**How to avoid:** Make the secondary jarringly different (`Comic Sans MS` next to `JetBrains Mono` is the right energy). Test on Mac, Windows, Linux — cursive fallback differs.
**Warning signs:** Online neighborhood looks identical to other neighborhoods.

### Pitfall 3: `AnimatePresence` swallows skin exit animations on type change
**What goes wrong:** Switching auction type mid-animation causes the new skin to mount before the old finishes exiting, producing visual jank.
**Why it happens:** Default `mode="sync"` runs enter and exit simultaneously.
**How to avoid:** Use `<AnimatePresence mode="wait">` so the exit completes before the next mounts. Always set unique `key` on the `<motion.div>` (use `auction.id` not `auction.auctionType` so different auctions of the same type also re-mount).
**Warning signs:** Two skins overlapping briefly during transitions.

### Pitfall 4: Tailwind v4 doesn't recognize `bg-[--color-accent]` without arbitrary value syntax
**What goes wrong:** `bg-[--color-accent]` shows up as no class.
**Why it happens:** Arbitrary values in v4 use the same `[bracket]` syntax but the variable must be referenced as `var(--color-accent)` inside or use the shorthand.
**How to avoid:** Use either `bg-[var(--color-accent)]` (explicit) or rely on the shorthand `bg-(--color-accent)` introduced in v4.1+. Verify which syntax the installed v4.2.2 supports — test `bg-[--color-accent]`, `bg-[var(--color-accent)]`, and `bg-(--color-accent)` in dev before committing to one.
**Warning signs:** Accent color not appearing on elements; no class generated by JIT.

### Pitfall 5: Replacing palette without removing dark theme creates inconsistent half-state
**What goes wrong:** Phase 2 commits add tokens but leave `bg-zinc-950` on the body and `bg-zinc-900` on game panels — game looks half-dark, half-light.
**Why it happens:** Incremental refactor instinct.
**How to avoid:** Wave 0 single commit must (a) rewrite `index.css` body background to `bg-paper`, (b) remove `bg-zinc-950` from `GameBoard.tsx` line 40, (c) remove all `bg-zinc-800/900/950`, `text-white`, `text-zinc-*` classes from `GameBoard`, `AuctionPanel`, `PlayerHand`, `RoundEndModal`, `GameOverModal` in the same wave.
**Warning signs:** White panels on black background, or black text on dark panels.

### Pitfall 6: Receipt clip-path keyframes don't reveal because parent has `overflow: hidden`
**What goes wrong:** Receipt mounts but the print animation doesn't play.
**Why it happens:** `clip-path: inset(0 0 100% 0)` clips the element, but if a parent also clips, the result is invisible.
**How to avoid:** Ensure direct parents of `<Receipt>` do not have `overflow: hidden` or `clip-path` of their own. The receipt creates its own stacking context.
**Warning signs:** Receipt appears instantly with no animation.

### Pitfall 7: Online flicker triggers seizure warnings if too fast
**What goes wrong:** Players with photosensitive conditions get headaches; WCAG violation.
**Why it happens:** Flicker rate exceeds 3 flashes per second.
**How to avoid:** Keep flicker cycle ≥ 7 seconds with discrete pulses ≤ 100ms each, no more than 3 transitions per second total. Add `prefers-reduced-motion` media query that disables the flicker entirely.
**Warning signs:** Any flash rate > 3 Hz, or > 25% of the screen flashing simultaneously.

```css
@media (prefers-reduced-motion: reduce) {
  .neighborhood-online { animation: none; }
}
```

## Code Examples

### Example 1: Wiring NeighborhoodProvider into GameBoard

```typescript
// src/components/game/GameBoard.tsx (after rewrite)
import { NeighborhoodProvider } from '../../contexts/NeighborhoodContext'
import { WallLabel } from '../aesthetic/WallLabel'
// ... other imports

export function GameBoard(/* ...props */) {
  // Phase 2: hard-code 'gallery' as the active neighborhood. Phase 3 will read from sim state.
  const activeNeighborhood = 'gallery' as const

  return (
    <NeighborhoodProvider neighborhood={activeNeighborhood}>
      <div className="min-h-screen bg-paper text-ink">
        {/* Header in wall-label style */}
        <header className="border-b border-ink px-section py-4 flex items-baseline justify-between">
          <WallLabel size="lg">NFART · ROUND {game.round} OF 4</WallLabel>
          <WallLabel size="sm">{`$${myMoney.toLocaleString()}`}</WallLabel>
        </header>
        {/* ... rest of layout ... */}
      </div>
    </NeighborhoodProvider>
  )
}
```

### Example 2: Receipt replacing RoundEndModal

```typescript
// src/components/game/RoundEndDisplay.tsx (replaces RoundEndModal)
import { Receipt, ReceiptRow } from '../aesthetic/Receipt'
import { ARTIST_NAMES } from '../../types/game'

export function RoundEndDisplay({ result, game, onDismiss }: RoundEndModalProps) {
  return (
    <div className="fixed inset-0 bg-paper/90 backdrop-blur-sm flex items-center justify-center z-50">
      <Receipt
        header={`AUCTION RESULT — ROUND ${result.round}`}
        subheader={`${game.players.length} BIDDERS · ${result.payouts.length} LOTS`}
        stamped
      >
        {result.rankings
          .filter(r => r.value > 0)
          .map(r => (
            <ReceiptRow
              key={r.artist}
              label={ARTIST_NAMES[r.artist].toUpperCase()}
              value={`$${r.cumulativeValue.toLocaleString()}`}
            />
          ))}
        <div className="border-t border-dashed border-rule my-2" />
        {result.payouts
          .map((p, idx) => ({ p, player: game.players[idx] }))
          .sort((a, b) => b.p.amount - a.p.amount)
          .map(({ p, player }) => (
            <ReceiptRow
              key={player?.id}
              label={player?.displayName.toUpperCase() ?? ''}
              value={`+$${p.amount.toLocaleString()}`}
            />
          ))}
      </Receipt>
      <button
        onClick={onDismiss}
        className="absolute bottom-section left-1/2 -translate-x-1/2 font-label uppercase tracking-[0.2em] text-sm border border-ink px-6 py-3 hover:bg-ink hover:text-paper transition-colors"
      >
        CONTINUE
      </button>
    </div>
  )
}
```

### Example 3: AppraisalForm for player stats

```typescript
import { AppraisalForm } from '../aesthetic/AppraisalForm'

<AppraisalForm
  title="PLAYER APPRAISAL"
  formNumber="FORM A-01"
  rows={[
    { label: 'MONEY',      value: `$${myMoney.toLocaleString()}`, emphasis: true },
    { label: 'COOLNESS',   value: '4 / 10' },
    { label: 'RESTEDNESS', value: '7 / 10' },
    { label: 'LUCK',       value: '5 / 10' },
  ]}
  footer="ASSESSED ON ROUND OPENING"
/>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` `theme.extend.colors` | `@theme` directive in CSS | Tailwind v4 (2024-2025) | Tokens live with stylesheets, generated as CSS vars automatically |
| `framer-motion` package | `motion` package (`motion/react`) | 2025 (Framer spinoff) | `framer-motion` 12 is now a re-export shim of `motion`. Migration is one import line. STACK.md says defer migration. |
| `AnimateSharedLayout` for shared element transitions | Explicit variants (or `layoutId` with caveats) | framer-motion 4+ | `AnimateSharedLayout` removed; CONTEXT.md and STACK.md flag `layoutId` perf cost — use explicit variants |
| JS-driven typewriter | CSS `@keyframes typewriter` with `steps()` | Always supported, popularized 2020+ | Zero JS, GPU-driven |

**Deprecated/outdated:**
- `tailwind.config.js` for token definition (still works as escape hatch but not the v4 idiom)
- `AnimateSharedLayout` (removed in framer-motion 4)
- `next/font` style font optimization (irrelevant — no Next.js)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tailwind v4.2.2 supports `bg-[var(--color-accent)]` arbitrary value syntax | Pitfall 4, all examples | If syntax differs, all accent-color references break — must test in dev before locking |
| A2 | `Special Elite` and `JetBrains Mono` from Google Fonts are appropriate display/mono faces for the zine aesthetic | Standard Stack §1 | Font choice is taste — user may want different faces; substitution is mechanical |
| A3 | Hex codes for the 5 neighborhoods (#2e4b8b, #d97706, #b91c1c, #c8b88a, #0f766e) match brief intent | Pattern 1 | CONTEXT.md grants Claude discretion on exact hex codes — but user may want different shades after seeing them |
| A4 | The `clip-path` receipt-print animation works without parent `overflow: hidden` interference in current `GameBoard` layout | Pitfall 6 | If parents clip, animation invisible — fix by removing parent overflow or using `height` animation instead |
| A5 | `Comic Sans MS` is installed on all target user platforms (Mac/Win/Linux) | Pattern 9 | On bare Linux it falls through to generic `cursive`; visual gag still works but differently |
| A6 | 7-second flicker cycle with sub-100ms pulses satisfies WCAG 2.3.1 and avoids photosensitivity issues | Pitfall 7 | If too fast, real accessibility risk — `prefers-reduced-motion` mitigation is mandatory, not optional |
| A7 | Hard-coding `'gallery'` as the active neighborhood in Phase 2 GameBoard is acceptable until Phase 3 wires sim state | Code Example 1 | Phase 3 must wire `useSim()` into NeighborhoodProvider; if forgotten, the whole game stays gallery-blue |
| A8 | RoundEndModal can be replaced (not extended) without breaking `roundEndResult` flow in `useGame.ts` | Code Example 2 | Component name change — must update import in `GameBoard.tsx`; one-line change |
| A9 | Double auction skin overriding the white palette to dark is acceptable per the brief ("dark background") | Pattern 8 table | Brief explicitly says dark background for Double — only skin allowed to break white-base rule |

## Open Questions

1. **Exact font choices for `--font-label` and `--font-receipt`**
   - What we know: Must be monospace-leaning, must support small caps, must be free (Google Fonts CDN)
   - What's unclear: Whether `Special Elite` (typewriter), `IBM Plex Mono`, `Courier Prime`, or something else best matches the brief's intent
   - Recommendation: Pick `Special Elite` for label and `JetBrains Mono` for receipt as defaults; surface in `/gsd-discuss-phase` as an explicit user decision before Wave 1

2. **Should the Double auction skin completely override the NeighborhoodProvider, or just override the palette tokens?**
   - What we know: Brief says "dark background, drop format" for Double
   - What's unclear: Whether the accent color should still flow from neighborhood, or whether Double has its own fixed palette
   - Recommendation: Override palette to dark, keep accent driven by neighborhood — produces "this neighborhood at night" feel

3. **Where does the active neighborhood come from in Phase 2?**
   - What we know: Phase 3 will wire it to sim state. Phase 2 doesn't have sim state yet.
   - What's unclear: Whether to hard-code `'gallery'`, cycle through all 5 in dev mode, or read from a query param
   - Recommendation: Hard-code `'gallery'` in `GameBoard.tsx`. Add a temporary debug `<select>` to switch neighborhoods at runtime for visual QA — remove in Phase 3 when sim wires it.

4. **Tailwind v4 arbitrary value syntax verification**
   - What we know: v4 generally supports `bg-[var(--x)]`; some shorthand syntaxes were added in 4.1+
   - What's unclear: Whether `bg-[--color-accent]` (without `var()`) works in 4.2.2
   - Recommendation: Wave 0 task: write a one-line test in `index.css` and a test element in `GameBoard.tsx` to verify which syntax the installed version supports; lock that syntax for the rest of the phase

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Tailwind CSS | All component styling | ✓ | 4.2.2 | — |
| framer-motion | Auction skins | ✓ | 12.38.0 | — |
| clsx | Conditional classes | ✓ | 2.x | — |
| React 19 createContext | NeighborhoodContext | ✓ | 19.2.4 | — |
| Google Fonts CDN | Display/mono fonts | ✓ (network) | n/a | System monospace fallbacks acceptable |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** Google Fonts can fail to load — system fonts (`ui-monospace`, `monospace`) cover the fallback gracefully.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4 (added in Phase 1) + @testing-library/react |
| Config file | `vite.config.ts` (test config inline) |
| Quick run command | `npx vitest run src/components/aesthetic` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AEST-01 | Body uses `--color-paper` background after Wave 0 | smoke (visual) | manual + screenshot | manual |
| AEST-02 | NeighborhoodProvider sets `--color-accent` CSS var on its `data-neighborhood` div | unit | `npx vitest run src/contexts/NeighborhoodContext.test.tsx` | ❌ Wave 0 |
| AEST-03 | WallLabel renders structured form (artist/title/medium/year) | unit | `npx vitest run src/components/aesthetic/WallLabel.test.tsx` | ❌ Wave 0 |
| AEST-04 | Receipt renders header, rows, and `stamped` overlay | unit | `npx vitest run src/components/aesthetic/Receipt.test.tsx` | ❌ Wave 0 |
| AEST-05 | AppraisalForm renders rows with labels and values | unit | `npx vitest run src/components/aesthetic/AppraisalForm.test.tsx` | ❌ Wave 0 |
| AEST-06 | OpenAuctionSkin renders given an `open` auction state | unit | `npx vitest run src/components/game/auction-skins/OpenAuctionSkin.test.tsx` | ❌ Wave 0 |
| AEST-07 | OnceAroundSkin renders given an `once_around` auction state | unit | same pattern | ❌ Wave 0 |
| AEST-08 | SealedBidSkin reveal triggers when all submitted | unit | same pattern | ❌ Wave 0 |
| AEST-09 | FixedPriceSkin renders price tag | unit | same pattern | ❌ Wave 0 |
| AEST-10 | DoubleSkin renders with dark background variant | unit | same pattern | ❌ Wave 0 |
| AEST-11 | NeighborhoodProvider with `online` adds `neighborhood-online` class (which CSS hooks broken font + flicker) | unit | included in NeighborhoodContext test | ❌ Wave 0 |

**Manual-only justification:** Visual fidelity (typography spacing, exact color rendering, animation feel) cannot be automated meaningfully without visual regression tooling (deferred to v2 per STACK.md). Unit tests cover **structural correctness** (the right elements with the right classes/data-attributes); humans cover **aesthetic correctness**.

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/aesthetic` (fast — < 5s)
- **Per wave merge:** `npx vitest run` (full suite including Phase 1 engine tests)
- **Phase gate:** Full suite green + manual visual QA on all 5 auction skins + Online neighborhood flicker check before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/contexts/NeighborhoodContext.test.tsx` — covers AEST-02, AEST-11
- [ ] `src/components/aesthetic/WallLabel.test.tsx` — covers AEST-03
- [ ] `src/components/aesthetic/Receipt.test.tsx` — covers AEST-04
- [ ] `src/components/aesthetic/AppraisalForm.test.tsx` — covers AEST-05
- [ ] `src/components/game/auction-skins/*.test.tsx` (5 files) — covers AEST-06 through AEST-10
- [ ] Verify `vite.config.ts` test environment is `jsdom` (currently `node` per line 9 of vite.config.ts) — must change for component tests
- [ ] Verify `@testing-library/react` and `jsdom` are installed (added in Phase 1 per STACK.md plan; confirm in Wave 0)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 1 handled host assignment server-side |
| V3 Session Management | no | No session changes in Phase 2 |
| V4 Access Control | no | No access changes in Phase 2 |
| V5 Input Validation | no | Phase 2 adds no inbound message types |
| V6 Cryptography | no | No cryptography in Phase 2 |
| V14 Configuration | yes (minor) | CSS-only changes; no env vars introduced |

### Known Threat Patterns for Phase 2 (CSS / React)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSS injection via untrusted accent color values | Tampering | Only enum-based neighborhood values flow into `--color-accent`; never user-controlled |
| `dangerouslySetInnerHTML` for receipt rendering | Tampering / Info Disclosure | Never use it — Receipt renders children React nodes, not HTML strings |
| Photosensitive epilepsy from Online flicker | Safety (not STRIDE proper) | WCAG 2.3.1 — flash rate ≤ 3 Hz; `prefers-reduced-motion` disables animation |
| Font CDN as third-party tracking vector | Info Disclosure | Acceptable (Google Fonts is universal); for stricter posture, self-host fonts (deferred) |

**Phase 2 introduces no new server-side attack surface.** All work is client-side rendering.

## Sources

### Primary (HIGH confidence)
- Tailwind v4 `@theme` directive: https://tailwindcss.com/docs/theme [VERIFIED via WebFetch]
- framer-motion `AnimatePresence` API: https://motion.dev/docs/react-animate-presence [VERIFIED via WebFetch]
- React Context API: https://react.dev/reference/react/createContext
- MDN font-family fallback resolution: https://developer.mozilla.org/en-US/docs/Web/CSS/font-family
- WCAG 2.3.1 (Three Flashes or Below Threshold): https://www.w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html
- Existing codebase: `src/index.css`, `src/components/game/AuctionPanel.tsx`, `src/components/game/RoundEndModal.tsx`, `src/components/game/GameBoard.tsx`, `src/components/game/PlayerHand.tsx`, `vite.config.ts` [VERIFIED via Read]
- `.planning/research/SUMMARY.md` and `.planning/research/STACK.md` (project research) [VERIFIED via Read]
- `.planning/codebase/CONVENTIONS.md` and `STRUCTURE.md` [VERIFIED via Read]

### Secondary (MEDIUM confidence)
- CSS `@property` for animatable custom properties: https://developer.mozilla.org/en-US/docs/Web/CSS/@property
- CSS `clip-path` animation patterns: common practice, multiple sources
- Museum wall-label conventions: Smithsonian / MoMA published guidelines (general design knowledge)

### Tertiary (LOW confidence)
- Hex color choices for the 5 neighborhoods (Pattern 1) — these are taste decisions, not researched values
- Font face recommendations (`Special Elite`, `JetBrains Mono`) — taste decisions
- Animation timing curves for skin transitions — taste decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies present and documented
- Architecture (4-layer plan): HIGH — clean orthogonal decomposition, each layer testable independently
- Tailwind v4 `@theme` syntax: HIGH — verified from official docs
- framer-motion variant patterns: HIGH — verified from motion.dev
- Online broken-font + flicker techniques: MEDIUM — technique works but exact aesthetic outcome is taste-dependent
- Pitfalls: HIGH — most are concrete CSS/JS gotchas with clear mitigations
- Specific hex codes and font choices: LOW — explicit user discretion, surface for confirmation

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (30 days — Tailwind v4 and framer-motion 12 are stable)

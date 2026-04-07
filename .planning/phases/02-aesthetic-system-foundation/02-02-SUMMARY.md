---
phase: 02-aesthetic-system-foundation
plan: 02
subsystem: aesthetic-primitives
tags: [wall-label, receipt, appraisal-form, primitives, tdd, framer-motion]
one-liner: "Three aesthetic primitives (WallLabel, Receipt, AppraisalForm) built TDD-first and wired into the round-end modal, game-over leaderboard, and GameBoard header to prove the contract end-to-end."
dependency-graph:
  requires:
    - "Plan 02-01: tokens.css @theme block, keyframes.css (receipt-print, dotted-rule), NeighborhoodProvider"
    - "framer-motion 12 (already installed)"
    - "@testing-library/react + jsdom (bootstrapped in Plan 02-01)"
  provides:
    - "src/components/aesthetic/WallLabel.tsx — structured + free-form gallery wall-label primitive"
    - "src/components/aesthetic/Receipt.tsx — printed-receipt primitive + ReceiptRow helper"
    - "src/components/aesthetic/AppraisalForm.tsx — key/value official-document primitive + AppraisalRow type"
  affects:
    - "Phase 3 sim panels will consume AppraisalForm for stats"
    - "Phase 4 drug inventory will consume AppraisalForm"
    - "Phase 5 NFT panel + end-state appraisal will consume all three"
    - "All future game copy should flow through WallLabel, not raw text spans"
tech-stack:
  added: []
  patterns:
    - "TDD red→green for presentational primitives with @testing-library/react"
    - "framer-motion mock at test boundary (motion.div passthrough) to keep jsdom happy"
    - "data-* hooks (data-receipt-rule, data-receipt-stamp, data-receipt-label, data-appraisal-footer) so tests assert structure without text coupling"
key-files:
  created:
    - "src/components/aesthetic/WallLabel.tsx"
    - "src/components/aesthetic/WallLabel.test.tsx"
    - "src/components/aesthetic/Receipt.tsx"
    - "src/components/aesthetic/Receipt.test.tsx"
    - "src/components/aesthetic/AppraisalForm.tsx"
    - "src/components/aesthetic/AppraisalForm.test.tsx"
  modified:
    - "src/components/game/RoundEndModal.tsx"
    - "src/components/game/GameOverModal.tsx"
    - "src/components/game/GameBoard.tsx"
decisions:
  - "Framer-motion mocked minimally in Receipt.test.tsx (motion.div → plain div) so animation code never runs under jsdom. Same mock pattern can be reused by future tests that touch Receipt-consuming components."
  - "Receipt rule lines use data-receipt-rule attributes (not text equality) so the count/content assertion is structural, not brittle against future character changes."
  - "AppraisalForm has NO live consumer in Phase 2 by design — it ships with full test coverage so Phase 3 sim stats and Phase 4 drug inventory can drop it in without revisiting the API."
  - "RoundEndModal Receipt subheader is always a string (no conditional React node) so the Receipt primitive's subheader prop contract stays typed as string."
metrics:
  duration: "~5 minutes"
  tasks_completed: 2
  tests_added: 16
  tests_total: 57
  files_created: 6
  files_modified: 3
  completed: "2026-04-06T21:47:00Z"
requirements: [AEST-03, AEST-04, AEST-05]
---

# Phase 02 Plan 02: Aesthetic Primitives Summary

## One-liner

Three reusable aesthetic primitives — `WallLabel`, `Receipt` (+ `ReceiptRow`), `AppraisalForm` (+ `AppraisalRow`) — shipped with 16 locked test behaviors and immediately threaded into the round-end modal, game-over leaderboard, and GameBoard header. Every downstream phase now has the vocabulary it needs.

## Primitive APIs

### WallLabel (`src/components/aesthetic/WallLabel.tsx`)

```tsx
interface WallLabelProps {
  title?: string
  artist?: string
  medium?: string
  year?: string | number
  dimensions?: string
  children?: ReactNode      // Free-form inline variant
  size?: 'sm' | 'md' | 'lg' // default 'md'
  className?: string
}
export function WallLabel(props: WallLabelProps): JSX.Element
```

**Two rendering modes:**

- **Free-form inline** (`children` provided): renders a `<span>` with `font-label uppercase tracking-[0.18em] text-ink` + size class. Used for single-line copy in headers/status bars.
- **Structured block** (no children): renders a `<div>` stack of artist (bold tracked uppercase) → italic title with `, {year}` suffix → medium (soft) → dimensions (soft, xs). Mimics a real gallery wall label.

**Size map:** `sm → text-xs`, `md → text-sm`, `lg → text-base`.

**Sample usage:**

```tsx
// Free-form (GameBoard header)
<WallLabel size="lg">NFART · ROUND {round} OF 4</WallLabel>
<WallLabel size="sm">{isMyTurn ? 'YOUR TURN' : 'AUCTION IN PROGRESS'}</WallLabel>

// Structured (future: painting detail panel)
<WallLabel
  artist="YOKO"
  title="Untitled (Red)"
  year={2024}
  medium="Oil on canvas"
  dimensions="24 × 36 in"
/>
```

### Receipt + ReceiptRow (`src/components/aesthetic/Receipt.tsx`)

```tsx
interface ReceiptProps {
  header?: string
  subheader?: string
  children: ReactNode
  stamped?: boolean
  className?: string
}
export function Receipt(props: ReceiptProps): JSX.Element

export function ReceiptRow({
  label,
  value,
}: {
  label: string
  value: string | number
}): JSX.Element
```

**Render contract:**

- Wraps content in a `motion.div` with `initial={{ opacity: 0, y: -8 }}, animate={{ opacity: 1, y: 0 }}, exit={{ opacity: 0, y: 8 }}`.
- Container class: `relative bg-paper text-ink font-receipt p-6 max-w-md mx-auto border border-rule receipt-print` (the `receipt-print` class fires the clip-path keyframe from Plan 01).
- Header renders `═ × 28` rule → uppercase tracked header → optional subheader (soft, xs) → `═ × 28` rule. Each rule carries `data-receipt-rule`.
- `stamped={true}` renders an absolutely-positioned `PRINTED` badge top-right with `border-2 border-[var(--color-stamp)] text-[var(--color-stamp)] -rotate-12 opacity-70`, marked `data-receipt-stamp`.
- `ReceiptRow` is a flex baseline row: uppercase tracked label on the left (`data-receipt-label`), bold tabular-nums value on the right.

**Sample usage:**

```tsx
<Receipt header="AUCTION RESULTS — ROUND 2" subheader="OF 4" stamped>
  <WallLabel size="sm">ARTIST RANKINGS</WallLabel>
  <ReceiptRow label="1. YOKO" value="+$30,000" />
  <ReceiptRow label="2. KARL GITTER" value="+$20,000" />
  <div className="dotted-rule my-3" />
  <WallLabel size="sm">PAYOUTS</WallLabel>
  <ReceiptRow label="MARTA G." value="+$42,000" />
</Receipt>
```

### AppraisalForm + AppraisalRow (`src/components/aesthetic/AppraisalForm.tsx`)

```tsx
export interface AppraisalRow {
  label: string
  value: ReactNode
  emphasis?: boolean
}

interface AppraisalFormProps {
  title: string
  formNumber?: string   // e.g. "FORM A-14"
  rows: AppraisalRow[]
  footer?: ReactNode
  className?: string
}
export function AppraisalForm(props: AppraisalFormProps): JSX.Element
```

**Render contract:**

- Outer `<section>` with paper + rule border.
- Header: flex row, title (uppercase tracked-[0.2em], bold) on the left, optional `formNumber` (soft, xs, tracked-[0.15em]) on the right, `border-b border-ink` rule beneath.
- Rows: `<dl>` of `<div>` containers each with `border-b border-dashed border-rule`. Each row is a `<dt>` (uppercase tracked-[0.12em], soft, xs, `min-w-[8rem]`) and `<dd>` (flex-1 right-aligned; `font-bold text-base` if `emphasis`, else `text-sm`).
- Footer: only rendered when `footer` prop provided (`data-appraisal-footer`), `mt-3 pt-3 border-t border-ink text-xs text-ink-soft`.
- Row keys are stable on `${label}-${index}` so repeat labels don't break reconciliation.

**Sample usage (Phase 3 sim stats placeholder):**

```tsx
<AppraisalForm
  title="GALLERY APPRAISAL"
  formNumber="FORM A-14"
  rows={[
    { label: 'PRESTIGE', value: '42' },
    { label: 'HYPE', value: '7' },
    { label: 'TOTAL', value: '$142,000', emphasis: true },
  ]}
  footer={<span>APPRAISER: GALLERY ASSISTANT</span>}
/>
```

## Live Consumers (after this plan)

| Primitive       | Consumer                                    | Usage                                              |
| --------------- | ------------------------------------------- | -------------------------------------------------- |
| `WallLabel`     | `src/components/game/GameBoard.tsx`         | Header (round/status/money), empty-state, history sidebar headers |
| `WallLabel`     | `src/components/game/RoundEndModal.tsx`     | "ARTIST RANKINGS" + "PAYOUTS" section headers inside Receipt |
| `WallLabel`     | `src/components/game/GameOverModal.tsx`     | Winner display-name block (size="lg")              |
| `Receipt`       | `src/components/game/RoundEndModal.tsx`     | Entire modal body is a Receipt with stamped flag   |
| `Receipt`       | `src/components/game/GameOverModal.tsx`     | Leaderboard wraps in a single stamped Receipt      |
| `ReceiptRow`    | `src/components/game/RoundEndModal.tsx`     | Ranking + payout rows                              |
| `ReceiptRow`    | `src/components/game/GameOverModal.tsx`     | Final standings rows                               |
| `AppraisalForm` | **None in Phase 2 — by design**             | First live consumer is Phase 3 sim stats / Phase 4 drug inventory per locked component architecture decision (02-CONTEXT §Component Architecture). Primitive is built and test-locked now so downstream phases can drop it in without revisiting the API. |

## Test Coverage (16 new tests, 57 total)

| File                   | Tests | Behaviors locked                                                                                     |
| ---------------------- | ----- | ---------------------------------------------------------------------------------------------------- |
| `WallLabel.test.tsx`     | 4     | structured variant text, free-form inline text, className passthrough, default size class          |
| `Receipt.test.tsx`       | 7     | header+subheader, rule element count/content, children body, stamped on/off, ReceiptRow label+value, ReceiptRow uppercase |
| `AppraisalForm.test.tsx` | 5     | title+formNumber+row, emphasis bold, footer omitted, footer rendered, row order preserved            |

All tests use `@testing-library/react` with `screen.getByText` / `container.querySelector` patterns established in Plan 02-01. Framer-motion is mocked minimally in `Receipt.test.tsx` so jsdom doesn't touch animation code.

## Deviations from Plan

None — the plan executed exactly as written. Two trivial clarifications applied during write:

- `RoundEndModal` subheader uses a fixed `'OF 4'` string rather than `` `OF ${4}` `` (functionally identical; avoids an unnecessary template literal).
- `GameOverModal` winner `WallLabel` is wrapped in a centered `<div>` so the large-size label aligns with the `DECLARED THE WINNER` subcaption visually. This matches the receipt's centered-header rhythm.

## Tasks Completed

| # | Task                                                                     | Commit    | Files                                                                                                                                                     |
| - | ------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | Build WallLabel / Receipt / AppraisalForm primitives with tests (TDD)    | `5b1421d` | `src/components/aesthetic/{WallLabel,Receipt,AppraisalForm}.tsx` + `.test.tsx` for each                                                                   |
| 2 | Swap RoundEndModal + GameOverModal to Receipt; thread WallLabel into GameBoard | `9a87a1c` | `src/components/game/RoundEndModal.tsx`, `src/components/game/GameOverModal.tsx`, `src/components/game/GameBoard.tsx`                                     |

## Verification

- `npx vitest run src/components/aesthetic/` → **16/16 passing** (Task 1 gate).
- `npx vitest run src/components/ src/contexts/` → **21/21 passing** (Task 2 gate).
- `npx vitest run` (full suite) → **57/57 passing** (36 engine + 5 context + 16 aesthetic primitive).
- `npx tsc --noEmit` → **clean**, no type regressions.
- Grep gate `🎨|🔨|🥇|🥈|🥉|🏆` against the three modified game files → **zero matches**.

## Success Criteria Delivered

- **AEST-03** — WallLabel is the single vehicle for game shell typography. GameBoard header, empty-state, history sidebar, and the two modals now route every visible string through `<WallLabel>` or `<ReceiptRow>` (which itself is uppercase tracked). Remaining game-copy sites (AuctionPanel, PlayerHand, etc.) will be migrated incrementally as Phase 3+ reskins them.
- **AEST-04** — RoundEndModal renders as a printed receipt: `═`-bounded header, `PRINTED` stamp at -12deg, dotted separator between rankings and payouts, framer-motion mount + CSS `receipt-print` clip-path reveal.
- **AEST-05** — AppraisalForm primitive exists with full locked API (rows / formNumber / emphasis / footer) and 5 passing tests. No live consumer in Phase 2 by design; Phase 3 sim stats and Phase 4 drug inventory will drop it in unchanged.

## Known Stubs

None. All three primitives are fully wired to real data in their live consumers (RoundEndModal consumes `RoundResult`, GameOverModal consumes `GameState.players`, GameBoard header consumes live `game.round` / `myMoney` / turn state). AppraisalForm has no live consumer in Phase 2 — this is an intentional, documented architectural decision, not a stub. It is fully tested and ready for Phase 3 to consume.

## Self-Check: PASSED

Created files verified present:

- FOUND: `src/components/aesthetic/WallLabel.tsx`
- FOUND: `src/components/aesthetic/WallLabel.test.tsx`
- FOUND: `src/components/aesthetic/Receipt.tsx`
- FOUND: `src/components/aesthetic/Receipt.test.tsx`
- FOUND: `src/components/aesthetic/AppraisalForm.tsx`
- FOUND: `src/components/aesthetic/AppraisalForm.test.tsx`

Commits verified present:

- FOUND: `5b1421d` (Task 1)
- FOUND: `9a87a1c` (Task 2)

Tests passing: 57/57. TypeScript: clean. Grep gates: zero matches.

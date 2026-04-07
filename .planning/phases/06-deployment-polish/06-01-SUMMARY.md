---
phase: 06-deployment-polish
plan: 06-01
subsystem: deployment
tags: [deployment, cloudflare-pages, partykit, cleanup, build]
requires: [phase-05]
provides: [public-deployment]
affects: [README, partykit-config, build-pipeline]
tech-stack:
  added: [cloudflare-pages-redirects]
  patterns: [spa-fallback-redirect, env-var-injection-at-build]
key-files:
  created:
    - public/_redirects
    - .planning/phases/06-deployment-polish/06-01-SUMMARY.md
  modified:
    - README.md
    - party/server.ts
    - src/components/sim/RelationshipPanel.test.tsx
    - src/components/sim/SimPanel.test.tsx
    - src/lib/sim-engine.ts
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
  deleted:
    - app/ (39 files — duplicate nested project root)
decisions:
  - Cloudflare Pages chosen as static host (same CDN as PartyKit Workers)
  - SPA routing via public/_redirects (Vite copies to dist/ automatically)
  - VITE_PARTYKIT_HOST is the only required production env var
  - Pre-existing TS build errors fixed inline (Rule 3 — blocking the production build)
metrics:
  duration: ~6min
  completed: 2026-04-06
---

# Phase 6 Plan 01: Deployment & Polish Summary

Repo cleanup, Cloudflare Pages config, and a green production build for NFArt Auction v1.

## What Shipped

- Deleted the duplicate `app/` subdirectory (39 tracked files) — root is now the single canonical source. `partykit.json` already pointed at root `party/server.ts`, so no config changes were needed.
- Verified zero `SUPABASE` references survive in `src/`, `party/`, `vite.config.ts`, and `package.json`. The only remaining mentions are in historical planning documents (`.planning/**`), which is intentional history.
- Cleaned up local `.env.local` (gitignored): removed stale `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, replaced with `VITE_PARTYKIT_HOST=nfart-auction.laulpogan.partykit.dev`.
- Added `public/_redirects` with `/* /index.html 200` for Cloudflare Pages SPA fallback. Vite copies this into `dist/` at build time (verified).
- Rewrote `README.md` with a real Deployment section covering PartyKit (`npx partykit deploy`), the Cloudflare Pages workflow (manual upload OR git integration with `npm run build` / output `dist`), and the single required env var.
- Hardened the production build by fixing five pre-existing TypeScript errors that would have blocked `npm run build`:
  - `party/server.ts` — `erasableSyntaxOnly` violation in the constructor parameter shorthand (`readonly room`). Refactored to a plain field + assignment in the constructor body.
  - `src/components/sim/RelationshipPanel.test.tsx` — unused `screen` import.
  - `src/components/sim/SimPanel.test.tsx` — unused `fireEvent` import.
  - `src/lib/sim-engine.ts` — unused `SIM_CONFIG` and `NFT_ITEM_DEFINITIONS` imports.

## Verification

| Check                  | Result                                              |
| ---------------------- | --------------------------------------------------- |
| `ls app/`              | `No such file or directory` (deleted)               |
| `grep -ri SUPABASE`    | Zero matches in `src/ party/ vite.config.ts package.json` |
| `npx tsc --noEmit`     | Exit 0 (clean)                                      |
| `npx vitest run`       | 21 files / 243 tests passed                         |
| `npm run build`        | Built `dist/` in 196ms (426kB JS / 40kB CSS)        |
| `dist/index.html`      | Exists                                              |
| `dist/_redirects`      | Exists, contains `/*    /index.html   200`         |
| `public/_redirects`    | Exists                                              |
| `README.md` Deployment | Section present with PartyKit + Pages + env var docs |

## Tasks

| Task | Name                                  | Commit  |
| ---- | ------------------------------------- | ------- |
| 1    | Delete duplicate app/ subdirectory    | b3c7abb |
| 2    | Verify no Supabase env vars (no commit — verification only; .env.local is gitignored) | — |
| 3    | Cloudflare Pages config + build fixes | 394614a |
| 4    | Final verification (tsc/vitest/build) | (this commit) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Fixed five pre-existing TypeScript build errors**
- **Found during:** Task 3 (`npm run build`)
- **Issue:** `tsc -b` (run as part of `npm run build`) failed with one `erasableSyntaxOnly` error in `party/server.ts` and four `TS6133` unused-binding errors in test/sim files. These predated Phase 6 but blocked the production build, which is the entire DEPLOY-02 acceptance criterion.
- **Fix:** Refactored the constructor in `party/server.ts` to a plain field assignment; removed the four unused imports.
- **Files modified:** `party/server.ts`, `src/components/sim/RelationshipPanel.test.tsx`, `src/components/sim/SimPanel.test.tsx`, `src/lib/sim-engine.ts`
- **Commit:** `394614a`

**2. [Rule 2 — Critical hygiene] Replaced stale Supabase vars in `.env.local`**
- **Found during:** Task 2
- **Issue:** Local `.env.local` still held `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from before the PartyKit migration. The file is gitignored so it would not have shipped, but it was misleading and could confuse a returning developer.
- **Fix:** Overwrote with the single required `VITE_PARTYKIT_HOST` line.
- **Files modified:** `.env.local` (gitignored — not committed)
- **Commit:** none (untracked file)

## Authentication Gates

None. `npx partykit deploy` is documented in the README for the user to run manually with their PartyKit credentials — that step is intentionally outside this plan's automation surface.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: `public/_redirects`
- FOUND: `dist/index.html`
- FOUND: `dist/_redirects`
- FOUND: `README.md` (with Deployment section)
- MISSING: `app/` (intentional — deleted)
- FOUND: commit `b3c7abb` (Task 1: delete duplicate app/)
- FOUND: commit `394614a` (Task 3: cloudflare pages config + build fixes)
- All 243 tests pass; tsc clean; build succeeds.

---
phase: 2
slug: aesthetic-system-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 + @testing-library/react + jsdom |
| **Config file** | `vite.config.ts` (Wave 0 switches test environment to jsdom) |
| **Quick run command** | `npx vitest run src/components/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 2-01-01 | 01 | 0 | AEST-01,02 | unit | `npx vitest run src/lib/theme.test.ts` | ⬜ pending |
| 2-01-02 | 01 | 1 | AEST-02 | unit | `npx vitest run src/components/NeighborhoodProvider.test.tsx` | ⬜ pending |
| 2-02-01 | 02 | 1 | AEST-03 | unit | `npx vitest run src/components/WallLabel.test.tsx` | ⬜ pending |
| 2-02-02 | 02 | 1 | AEST-04 | unit | `npx vitest run src/components/Receipt.test.tsx` | ⬜ pending |
| 2-02-03 | 02 | 1 | AEST-05 | unit | `npx vitest run src/components/AppraisalForm.test.tsx` | ⬜ pending |
| 2-03-01 | 03 | 2 | AEST-06,07,08,09,10 | unit | `npx vitest run src/components/auction-skins/` | ⬜ pending |
| 2-03-02 | 03 | 2 | AEST-11 | unit | `npx vitest run src/components/OnlineNeighborhood.test.tsx` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `@testing-library/react` and `jsdom` installed as devDependencies
- [ ] `vite.config.ts` test environment changed from `node` to `jsdom`
- [ ] `src/index.css` rewritten with `@theme` design tokens (white base, black type, neighborhood accents)
- [ ] Stub test files created for all primitives + skins

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual consistency in browser | All AEST | Visual judgment | Run `npm run dev`, navigate to game, verify white base + neighborhood accent |
| Online neighborhood font flicker | AEST-11 | Animation behavior | Render OnlineNeighborhood, observe accent color flicker visually |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] No 3 consecutive tasks without automated verify
- [ ] Wave 0 covers test infrastructure
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

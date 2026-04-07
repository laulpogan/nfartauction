---
phase: 1
slug: engine-hardening-security
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 |
| **Config file** | `vitest.config.ts` (Wave 0 creates) |
| **Quick run command** | `npx vitest run src/lib/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | ENG-01 | T-1-01 | sealedBids stripped from broadcast | unit | `npx vitest run src/lib/engine.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | ENG-02 | T-1-02 | deck absent from GameState broadcast | unit | `npx vitest run src/lib/engine.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | ENG-03 | T-1-03 | PLAY_SECOND_CARD enforced by server | unit | `npx vitest run src/lib/engine.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | ENG-04 | T-1-04 | isHost set by connection order | unit | `npx vitest run src/lib/engine.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | ENG-05 | T-1-05 | malformed message rejected before engine | unit | `npx vitest run src/lib/validation.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | ENG-06 | — | N/A (cleanup) | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 1-02-03 | 02 | 1 | ENG-07 | — | N/A (cleanup) | manual | `grep -r "supabase" src/` | ✅ | ⬜ pending |
| 1-03-01 | 03 | 2 | ENG-08 | — | round-end fires pre-auction | unit | `npx vitest run src/lib/engine.test.ts -t "round end"` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 2 | ENG-09 | — | reconnect restores roundEndResult | unit | `npx vitest run src/lib/engine.test.ts -t "reconnect"` | ❌ W0 | ⬜ pending |
| 1-03-03 | 03 | 2 | ENG-10 | — | all auction types + tie-break green | unit | `npx vitest run src/lib/engine.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` and `@vitest/ui` installed as devDependencies
- [ ] `vitest.config.ts` created at project root
- [ ] `src/lib/engine.test.ts` — stub file for engine unit tests
- [ ] `src/lib/validation.test.ts` — stub file for Zod schema validation tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supabase module fully removed | ENG-07 | File deletion not testable via vitest | `grep -r "supabase" src/ party/` returns no results |
| Dead SQL files deleted | ENG-07 | File deletion | `ls supabase_migration.sql 2>/dev/null` returns nothing |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

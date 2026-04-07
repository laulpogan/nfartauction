# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-06)

**Core value:** Friends can complete a full 4-round Modern Art auction game online, with gallery sim decisions shaping who they are when they sit down to bid.
**Current focus:** Phase 1 — Engine Hardening & Security

## Current Position

Phase: 1 of 6 (Engine Hardening & Security)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-04-06 — Roadmap created; 52 requirements mapped across 6 phases

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: Engine-first before sim — four critical bugs confirmed in live codebase (sealed bid leak, deck leak, no input validation, round-end trigger order)
- Init: Aesthetic system built into Phase 2 before any sim UI — visual restraint is the bit, not a retrofit
- Init: Root is canonical source; app/ subdirectory is an artifact to delete in Phase 6

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: Verify the Knizia sealed-bid tie-break rule (leftmost player from auctioneer) against the official rulebook PDF before writing tests
- Phase 3: Verify PartyKit 0.0.115 storage API shape (SQLite 2 MB vs KV 128 KiB) before implementing the KV storage split
- Phase 5: Define the NFT exchange rate volatility formula before implementation — it is a small design decision, not a research question

## Session Continuity

Last session: 2026-04-06
Stopped at: Roadmap and STATE.md created; REQUIREMENTS.md traceability updated
Resume file: None

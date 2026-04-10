---
phase: 07-bot-players
plan: 02
subsystem: server-bot-integration
tags: [bot, server, partykit, auction, sim-loop]
dependency_graph:
  requires: [bot-engine.ts, bot-config.ts, engine.ts, sim-engine.ts, game.ts]
  provides: [SET_BOT_COUNT handler, bot session creation, bot turn executor, bot sim day executor]
  affects: [party/server.ts]
tech_stack:
  added: []
  patterns: [bot-acting-guard, extracted-round-end-handler, recursive-bot-turn-loop]
key_files:
  created: []
  modified:
    - party/server.ts
decisions:
  - Extracted handleRoundEnd from PLAY_CARD for reuse by bot card plays
  - Bot sessions created BEFORE player-count validation so bots count toward 2-5 limit
  - executeBotTurn uses botActing flag with reset-before-recurse pattern (not try/finally for recursion)
  - Open auction bots all bid once then auto-end if auctioneer is a bot
  - Bot fixed price uses perceiveArtistValue * valuationMultiplier, clamped to min 1000
metrics:
  duration: 269s
  completed: "2026-04-10T04:09:00Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 0
  tests_total: 264
---

# Phase 7 Plan 02: Server Bot Integration Summary

SET_BOT_COUNT handler, bot session creation at START_GAME, and automatic bot turn/sim-day execution wired into all server state-change paths via bot-engine pure functions.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add SET_BOT_COUNT handler and bot session creation at START_GAME | 0250beb | party/server.ts |
| 2 | Bot turn executor — automatic actions after state changes | 0250beb | party/server.ts |

## Implementation Details

### SET_BOT_COUNT Handler
- Zod schema: `{ type: 'SET_BOT_COUNT', count: z.number().int().min(0).max(3) }`
- Host-only, lobby-only validation (T-7-03)
- Validates `humanCount + botCount <= 5` (T-7-06)
- Stores count in `ServerState.botCount`, initialized to 0

### Bot Session Creation (START_GAME)
- Creates bot sessions with personality rotation: conservative, aggressive, erratic
- Bot sessionIds use `bot-N` prefix (T-7-04: no WebSocket can claim these)
- Each bot gets: Session (isBot=true, botPersonality), empty hand, seeded PlayerSimState, empty neighborhoodHistory
- Bots added to game.players via sessionToPublicPlayer before startGame() call

### Bot Turn Executor (executeBotTurn)
- Fires after every broadcastStateSecure() in all auction handlers
- Handles all game states: card play, waiting_second, set_price, and all 5 active auction types
- Calls the same engine functions as human players (playCard, placeOpenBid, etc.)
- `botActing` guard prevents re-entrant loops (T-7-05)
- Recursive: after each bot action, re-checks if the next player is also a bot

### Bot Sim Day Executor (executeBotSimDay)
- Auto-submits bot slots via chooseBotSlots when phase transitions to sim_day
- Checks if all players (human + bot) submitted; if so, triggers advanceFromSimDay
- Called from: START_GAME, handleRoundEnd (sim_day transition), timeout handler

### Extracted handleRoundEnd
- Round-end logic extracted from PLAY_CARD handler into private method
- Reused by both human PLAY_CARD and bot executeBotTurn card plays
- Handles: endRound, session sync, phase transition, final appraisals, persist, broadcast

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **Combined commit**: Tasks 1 and 2 both modify party/server.ts and are interdependent (Task 1 creates stubs that Task 2 implements), so they were committed together.
2. **Bot fixed price setting**: Uses perceiveArtistValue * valuationMultiplier with a floor of 1000, matching the plan's formula.
3. **Open auction auto-end**: When auctioneer is a bot, all bots bid once then the auction is auto-ended via endOpenAuction to prevent hanging.
4. **Timeout handler**: Updated to async and calls executeBotSimDay before advanceFromSimDay to ensure bot slots are submitted before timeout-driven advance.

## Self-Check: PASSED

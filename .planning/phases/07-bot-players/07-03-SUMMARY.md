---
phase: 07-bot-players
plan: 03
subsystem: lobby-bot-ui
tags: [bot, lobby, ui, waiting-room, player-list]
dependency_graph:
  requires: [07-02-SUMMARY.md, useGame.ts, WaitingRoom.tsx, PlayerList.tsx, GamePage.tsx]
  provides: [bot-count-selector, bot-chip-display, setBotCount-action]
  affects: [src/components/lobby/WaitingRoom.tsx, src/components/game/PlayerList.tsx, src/hooks/useGame.ts, src/pages/GamePage.tsx]
tech_stack:
  added: []
  patterns: [host-only-conditional-render, local-state-for-intent]
key_files:
  created: []
  modified:
    - src/components/lobby/WaitingRoom.tsx
    - src/components/game/PlayerList.tsx
    - src/hooks/useGame.ts
    - src/pages/GamePage.tsx
decisions:
  - Bot count is local UI state until START_GAME fires; server creates bots at game start
  - Bot chip uses border-rule/text-ink-soft to differentiate from Host chip (border-ink/text-ink)
  - Empty seat placeholders account for botCount in totalCount calculation
metrics:
  duration: 81s
  completed: "2026-04-10T04:12:21Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 0
  tests_total: 264
---

# Phase 7 Plan 03: Lobby Bot UI Summary

Host-only bot count selector (0-3) in WaitingRoom with zine aesthetic, setBotCount action in useGame, and subtle "Bot" chip in both lobby and in-game PlayerList.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add bot count selector to WaitingRoom for host | 5294296 | WaitingRoom.tsx, PlayerList.tsx, useGame.ts |
| 2 | Wire onSetBotCount in parent component | 0557350 | GamePage.tsx |

## Implementation Details

### Bot Count Selector (WaitingRoom.tsx)
- Four toggle buttons (0, 1, 2, 3) styled with zine aesthetic (uppercase tracking, ink/paper colors)
- Rendered only when `isHost` is true, placed between Players section and Start button
- Local `botCount` state tracks host intent; `onSetBotCount` callback fires on change
- `canStart` uses `humanCount + botCount` toward the 2-5 player limit
- Start button text reflects total count: "Start Game with N Players"
- Empty seat placeholders use `totalCount` instead of `humanCount`

### Bot Chip (WaitingRoom.tsx + PlayerList.tsx)
- Detects bots via `sessionId.startsWith('bot-')` (matching server convention from Plan 02)
- Subtle chip: 9px text, border-rule color (softer than Host chip's border-ink)
- Added to both lobby player list (WaitingRoom) and in-game player list (PlayerList)

### useGame Hook
- Added `setBotCount: (count: number) => void` action that sends `{ type: 'SET_BOT_COUNT', count }`
- Follows same pattern as all other actions (uses `send` callback)

### GamePage Wiring
- Both WaitingRoom render paths (legacy fallback and phase switch) pass `onSetBotCount={actions.setBotCount}`

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compiles cleanly (`npx tsc --noEmit` passes)
- All 264 existing tests remain green
- Host sees bot selector; non-host does not (conditional on `isHost` prop)
- SET_BOT_COUNT sent via WebSocket when host changes selection

## Self-Check: PASSED

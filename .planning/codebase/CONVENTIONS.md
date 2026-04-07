# Coding Conventions

**Analysis Date:** 2026-04-06

## Naming Patterns

**Files:**
- React components: PascalCase, `.tsx` extension (e.g., `AuctionPanel.tsx`, `GameBoard.tsx`, `PlayerHand.tsx`)
- Hooks: camelCase prefixed with `use`, `.ts` extension (e.g., `useGame.ts`)
- Libraries/utilities: camelCase, `.ts` extension (e.g., `engine.ts`, `deck.ts`, `supabase.ts`)
- Types: camelCase, `.ts` extension (e.g., `game.ts`)
- Server files: camelCase, `.ts` extension (e.g., `server.ts`)

**Functions:**
- Exported pure functions: camelCase (e.g., `makePublicPlayer`, `emptyArtistCounts`, `buildDeck`, `shuffle`, `dealHands`)
- React components: PascalCase named exports (e.g., `export function AuctionPanel(...)`, `export function Button(...)`)
- Private class methods: camelCase prefixed with underscore is NOT used — instead, TypeScript `private` keyword (e.g., `private broadcastState()`, `private persist()`)
- Helper functions local to a module: camelCase, not exported (e.g., `hashString`, `getNextOnceAroundIdx`, `findOnceAroundWinner`, `formatMoney`)

**Variables:**
- camelCase for all local and module-level variables
- SCREAMING_SNAKE_CASE for exported module-level constants (e.g., `ROUND_VALUES`, `HAND_DISTRIBUTION`, `ROUND_END_THRESHOLD`, `ARTIST_NAMES`, `ARTIST_COLORS`, `PARTYKIT_HOST`)

**Types and Interfaces:**
- `type` aliases for unions and primitives: PascalCase (e.g., `Artist`, `AuctionType`, `GameStatus`, `AuctionStatus`)
- `interface` for object shapes: PascalCase (e.g., `Card`, `PublicPlayer`, `AuctionState`, `GameState`, `PlayerRecord`)
- Props interfaces: ComponentNameProps pattern (e.g., `ButtonProps`, `ModalProps`, `AuctionPanelProps`, `GameBoardProps`, `ArtCardProps`)
- Server-internal interfaces not exported (e.g., `Session`, `ServerState` in `party/server.ts`)

**Message types (WebSocket protocol):**
- SCREAMING_SNAKE_CASE strings for all message `type` fields (e.g., `'JOIN'`, `'START_GAME'`, `'PLAY_CARD'`, `'GAME_STATE'`, `'YOUR_HAND'`, `'ROUND_END'`, `'ERROR'`)

## Code Style

**Formatting:**
- No Prettier config detected — formatting is enforced by the developer's editor setup
- Consistent 2-space indentation throughout
- Single quotes for strings in TypeScript source
- Trailing commas in multi-line arrays/objects
- Object shorthand always used when key matches variable name

**Linting:**
- ESLint v9 with flat config at `eslint.config.js`
- Rules enforced: `@eslint/js` recommended, `typescript-eslint` recommended, `eslint-plugin-react-hooks` recommended, `eslint-plugin-react-refresh` vite preset
- TypeScript compiler strict checks: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `erasableSyntaxOnly`
- Target: ES2023, module resolution: bundler mode

**TypeScript:**
- `verbatimModuleSyntax` is enabled — use `import type` for type-only imports (enforced throughout, e.g., `import type { GameState, Card }`)
- `noEmit: true` — TypeScript is used for type checking only, Vite handles bundling
- No path aliases configured (all imports are relative)

## Import Organization

**Order (observed pattern):**
1. External packages (React, libraries) — e.g., `import { useState } from 'react'`, `import { clsx } from 'clsx'`
2. Internal type imports with `import type` keyword — e.g., `import type { GameState, Card } from '../../types/game'`
3. Internal value imports — e.g., `import { ARTIST_COLORS } from '../../types/game'`, `import { Button } from '../ui/Button'`

**Path style:**
- All imports are relative (no aliases)
- Types are always imported separately from values using `import type` syntax, per `verbatimModuleSyntax` requirement

**Example:**
```typescript
import { useState } from 'react'
import { clsx } from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'
import type { GameState } from '../../types/game'
import { ARTIST_NAMES, ARTIST_COLORS } from '../../types/game'
import { ArtCard } from './ArtCard'
import { Button } from '../ui/Button'
```

## Error Handling

**Strategy:**
- Engine functions (`src/lib/engine.ts`) throw `Error` with descriptive messages when invariants are violated (e.g., `throw new Error('No active auction')`, `throw new Error('Bid must exceed current bid')`)
- The PartyKit server (`party/server.ts`) wraps all message handling in try/catch and sends errors back to the client as `{ type: 'ERROR', message: String(e) }`
- The client hook (`src/hooks/useGame.ts`) surfaces server errors in a `error: string | null` state value
- The UI (`src/pages/GamePage.tsx`) renders a full-screen error state when error is set

**Pattern in server:**
```typescript
async onMessage(message: string, sender: Party.Connection) {
  const msg = JSON.parse(message)
  try {
    await this.handleMessage(msg, sender)
  } catch (e) {
    sender.send(JSON.stringify({ type: 'ERROR', message: String(e) }))
  }
}
```

**Guard pattern in engine:**
```typescript
if (!game.auction) throw new Error('No active auction')
```

## State Management

**Pattern:**
- No global state library (Zustand is a dependency in `package.json` but is NOT used anywhere in the source — see `CONCERNS.md`)
- State lives in the PartyKit server (`party/server.ts`) as `ServerState` persisted to durable storage via `this.room.storage`
- Client state is managed by the `useGame` hook (`src/hooks/useGame.ts`) using `useState` and `useRef`
- All mutations flow as WebSocket messages: client sends action → server computes new state → server broadcasts to all clients

**Immutability:**
- All state updates use spread/copy patterns throughout (no direct mutation): `{ ...game, auction: { ...auction, ... } }`
- Arrays are never mutated in place — spread or `.filter()` used

## Component Design

**Pattern:**
- Presentational components receive all data and callbacks as explicit props (no context, no global state access inside components)
- Prop interfaces are defined inline above the component using `interface ComponentNameProps`
- Props use `on` prefix for callbacks (e.g., `onSetFixedPrice`, `onPlayCard`, `onDismissRoundEnd`)
- Local UI state (e.g., input values, submitted flags) is managed with `useState` inside components

**Styling:**
- Tailwind CSS v4 via `@tailwindcss/vite` — no `tailwind.config.js`, configured via Vite plugin
- `clsx` is used for conditional class composition throughout (e.g., `clsx('base-class', { 'conditional': condition })`)
- Dark-first design: `bg-zinc-950` base, `bg-zinc-900` panels, `bg-zinc-800` inputs
- `framer-motion` used for all animation (`motion.div`, `motion.button`, `AnimatePresence`)

## Comments

**When to Comment:**
- Section dividers use a consistent banner style with `// ─── Section Name ────` to delineate logical groups within a file
- Inline comments explain non-obvious business logic (e.g., game rules, edge cases)
- JSDoc is not used

**Example of section banner:**
```typescript
// ─── Helpers ────────────────────────────────────────────────────────────────
// ─── Start Game ─────────────────────────────────────────────────────────────
// ─── Resolve Auction ──────────────────────────────────────────────────────────
```

## Function Design

**Pure functions:**
- Engine functions in `src/lib/engine.ts` are pure — they take state and return new state, never mutate
- Return type is always an object with named fields (e.g., `{ updatedGame, updatedPlayers }`, `{ updatedGame, updatedPlayer, roundEnded }`)

**Hooks:**
- `useCallback` wraps the `send` helper in `useGame` to avoid re-renders
- `useEffect` manages WebSocket lifecycle with proper cleanup (socket closed and ref nulled on teardown)
- `useRef` holds the socket to avoid effect re-runs on render

## Module Design

**Exports:**
- Named exports only — no default exports except `App.tsx` (the React app root) and `party/server.ts` (required by PartyKit)
- Types and constants are co-located in `src/types/game.ts` and exported from that single file

**Barrel files:**
- Not used — imports reference specific files directly

---

*Convention analysis: 2026-04-06*

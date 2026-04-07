# Codebase Structure

**Analysis Date:** 2026-04-06

## Directory Layout

```
nfartauction/app/               # Project root
├── src/                        # React frontend source
│   ├── main.tsx                # App bootstrap / React DOM entry
│   ├── App.tsx                 # Router definition
│   ├── index.css               # Global Tailwind base styles
│   ├── App.css                 # App-level animation styles
│   ├── types/
│   │   └── game.ts             # ALL game types, interfaces, constants
│   ├── lib/
│   │   ├── engine.ts           # Pure functional game rules
│   │   ├── deck.ts             # Deck building, shuffle, deal
│   │   └── supabase.ts         # Legacy DB helpers (unused)
│   ├── hooks/
│   │   └── useGame.ts          # WebSocket hook + action dispatch
│   ├── pages/
│   │   └── GamePage.tsx        # /game/:code route component
│   ├── components/
│   │   ├── game/               # In-game UI components
│   │   │   ├── GameBoard.tsx   # Main game layout shell
│   │   │   ├── AuctionPanel.tsx# All auction type UIs
│   │   │   ├── PlayerHand.tsx  # Card hand with play interaction
│   │   │   ├── ArtCard.tsx     # Single card display
│   │   │   ├── ArtistTracker.tsx # Artist count sidebar
│   │   │   ├── PlayerList.tsx  # Player money/status sidebar
│   │   │   ├── RoundEndModal.tsx # Round summary overlay
│   │   │   └── GameOverModal.tsx # Final scores overlay
│   │   ├── lobby/              # Pre-game UI components
│   │   │   ├── Lobby.tsx       # / route: create or join game
│   │   │   └── WaitingRoom.tsx # Lobby room waiting for players
│   │   └── ui/                 # Reusable primitives
│   │       ├── Button.tsx      # Variant button component
│   │       └── Modal.tsx       # Modal wrapper
│   └── assets/                 # Static image assets
│       ├── hero.png
│       ├── react.svg
│       └── vite.svg
├── party/
│   └── server.ts               # PartyKit WebSocket server (authoritative)
├── public/                     # Static files served as-is
├── dist/                       # Vite build output (committed, generated)
├── .partykit/                  # PartyKit local state cache (dev only)
├── .planning/                  # GSD planning documents
│   └── codebase/
├── index.html                  # Vite HTML entry point
├── vite.config.ts              # Vite + React + Tailwind plugin config
├── partykit.json               # PartyKit deployment config
├── package.json                # Dependencies and scripts
├── tsconfig.json               # Root TS config (references app + node)
├── tsconfig.app.json           # Frontend TS config
├── tsconfig.node.json          # Node/Vite TS config
├── eslint.config.js            # ESLint flat config
└── supabase_migration.sql      # Legacy schema (from prior Supabase backend)
```

Note: `app/` directory at the root is a copy/snapshot of the project root contents — both directories contain identical structure (same `src/`, `party/`, etc.). The active working directory is the project root, not `app/`.

## Directory Purposes

**`src/types/`:**
- Purpose: Single shared type definition module for the entire codebase
- Contains: All TypeScript interfaces and type aliases for game domain (`GameState`, `AuctionState`, `Card`, `PlayerRecord`, `PublicPlayer`, `RoundResult`); game constants (`ARTISTS`, `ROUND_VALUES`, `HAND_DISTRIBUTION`, `ROUND_END_THRESHOLD`); display maps (`ARTIST_NAMES`, `ARTIST_COLORS`, `AUCTION_TYPE_NAMES`, `AUCTION_TYPE_ICONS`)
- Key files: `src/types/game.ts`

**`src/lib/`:**
- Purpose: Pure business logic and utilities, framework-agnostic
- Contains: Game engine functions (`engine.ts`), deck operations (`deck.ts`), legacy Supabase client (`supabase.ts`, unused)
- Key files: `src/lib/engine.ts`, `src/lib/deck.ts`

**`src/hooks/`:**
- Purpose: React hooks encapsulating WebSocket communication
- Contains: `useGame` — the single hook managing the entire client-server connection lifecycle
- Key files: `src/hooks/useGame.ts`

**`src/pages/`:**
- Purpose: Route-level components, one per route
- Contains: `GamePage` which owns the `useGame` call and routes rendering to `WaitingRoom` or `GameBoard`
- Key files: `src/pages/GamePage.tsx`

**`src/components/game/`:**
- Purpose: All UI rendered during active gameplay
- Contains: Layout shell (`GameBoard`), auction-type-specific UI (`AuctionPanel`), hand management (`PlayerHand`), card display (`ArtCard`), sidebars (`ArtistTracker`, `PlayerList`), end-of-round/game modals
- Key files: `src/components/game/GameBoard.tsx`, `src/components/game/AuctionPanel.tsx`, `src/components/game/PlayerHand.tsx`

**`src/components/lobby/`:**
- Purpose: Pre-game entry and waiting UI
- Contains: `Lobby` (create/join flow), `WaitingRoom` (players list before game start)
- Key files: `src/components/lobby/Lobby.tsx`, `src/components/lobby/WaitingRoom.tsx`

**`src/components/ui/`:**
- Purpose: Reusable, generic UI primitives with no game domain knowledge
- Contains: `Button` (5 variants: primary, secondary, danger, ghost, gold), `Modal`
- Key files: `src/components/ui/Button.tsx`

**`party/`:**
- Purpose: PartyKit server — runs on Cloudflare Workers via the PartyKit platform
- Contains: Single `server.ts` exporting `GameServer implements Party.Server`
- Key files: `party/server.ts`

## Key File Locations

**Entry Points:**
- `index.html`: HTML shell, references `src/main.tsx` via Vite
- `src/main.tsx`: React DOM bootstrap
- `src/App.tsx`: Route definitions
- `party/server.ts`: WebSocket server (declared as `main` in `partykit.json`)

**Configuration:**
- `vite.config.ts`: Vite with `@vitejs/plugin-react` and `@tailwindcss/vite`
- `partykit.json`: PartyKit deployment config (`name: nfart-auction`, `main: party/server.ts`)
- `tsconfig.json`: References `tsconfig.app.json` and `tsconfig.node.json`
- `eslint.config.js`: ESLint 9 flat config with TypeScript and React hooks plugins

**Core Logic:**
- `src/types/game.ts`: Start here for any domain understanding
- `src/lib/engine.ts`: All auction resolution, round ending, card play rules
- `src/lib/deck.ts`: Deck composition and dealing
- `src/hooks/useGame.ts`: Client-server bridge; the only place `PartySocket` is used

**Game UI:**
- `src/components/game/AuctionPanel.tsx`: Handles all 5 auction types' UI (`open`, `once_around`, `sealed_bid`, `fixed_price`, `double`)

## Naming Conventions

**Files:**
- React components: PascalCase matching the exported function name — `GameBoard.tsx`, `AuctionPanel.tsx`
- Hooks: camelCase with `use` prefix — `useGame.ts`
- Lib utilities: camelCase — `engine.ts`, `deck.ts`
- Types: camelCase — `game.ts`

**Directories:**
- Feature groupings: lowercase — `game/`, `lobby/`, `ui/`
- Standard React dirs: lowercase — `components/`, `hooks/`, `pages/`, `lib/`, `types/`, `assets/`

**Exports:**
- Named exports throughout — no default component exports except `App.tsx` and `main.tsx`
- Type exports use `export type` syntax (e.g., `export type { GameState }` or `export interface`)

**Message Types:**
- Server-client WebSocket messages use SCREAMING_SNAKE_CASE strings: `'GAME_STATE'`, `'YOUR_HAND'`, `'PLAY_CARD'`, `'ROUND_END'`, `'ERROR'`

## Where to Add New Code

**New Game Rule / Auction Mechanic:**
- Engine logic: `src/lib/engine.ts` — add a pure function, export it
- Server handler: `party/server.ts` → `handleMessage()` — add a new `if (msg.type === 'NEW_TYPE')` block, call engine function
- Client action: `src/hooks/useGame.ts` → `actions` object — add `newAction: () => send({ type: 'NEW_TYPE' })`
- UI: `src/components/game/AuctionPanel.tsx` — add conditional rendering block for the new auction status

**New Page / Route:**
- Component: `src/pages/NewPage.tsx`
- Route: `src/App.tsx` — add `<Route path="/new-path" element={<NewPage />} />`

**New Game Component:**
- Place in: `src/components/game/NewComponent.tsx` (game-domain) or `src/components/lobby/NewComponent.tsx` (pre-game)
- Import into: `src/components/game/GameBoard.tsx` or the relevant parent

**New Reusable UI Primitive:**
- Place in: `src/components/ui/NewPrimitive.tsx`

**New Type / Interface:**
- Add to: `src/types/game.ts` — this is the single types file; do not create separate type files

**New Constants:**
- Add to: `src/types/game.ts` alongside existing constants (`ROUND_VALUES`, `HAND_DISTRIBUTION`, etc.)

## Special Directories

**`.partykit/`:**
- Purpose: Local PartyKit dev server state cache (rooms, durable object storage)
- Generated: Yes (by `partykit dev`)
- Committed: No (in `.gitignore`)

**`dist/`:**
- Purpose: Vite production build output
- Generated: Yes (by `npm run build`)
- Committed: Yes (currently in repo — unusual)

**`.planning/`:**
- Purpose: GSD planning and codebase analysis documents
- Generated: Yes (by GSD commands)
- Committed: Yes

# Technology Stack

**Analysis Date:** 2026-04-06

## Languages

**Primary:**
- TypeScript ~6.0.2 - All source code in `src/` and `party/server.ts`

**Secondary:**
- CSS - Global styles in `src/index.css` and `src/App.css`

## Runtime

**Environment:**
- Node.js v25.9.0

**Package Manager:**
- npm 11.12.1
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 19.2.4 - UI framework; entry point `src/main.tsx`
- React Router DOM 7.14.0 - Client-side routing; configured in `src/App.tsx` with `BrowserRouter`
- Tailwind CSS 4.2.2 - Utility-first styling; integrated via Vite plugin in `vite.config.ts`

**Backend/Realtime:**
- PartyKit 0.0.115 - WebSocket server runtime; server code in `party/server.ts`; config in `partykit.json`
- PartySocket 1.1.16 - Client-side WebSocket connection to PartyKit; used in `src/hooks/useGame.ts`

**Build/Dev:**
- Vite 8.0.4 - Build tool and dev server; config in `vite.config.ts`
- `@vitejs/plugin-react` 6.0.1 - React fast refresh via Oxc

## Key Dependencies

**Critical:**
- `partysocket` 1.1.16 - Manages WebSocket connection lifecycle with auto-reconnect; central to all multiplayer communication in `src/hooks/useGame.ts`
- `@supabase/supabase-js` 2.101.1 - Supabase client; helper functions in `src/lib/supabase.ts`. Note: the active game backend is PartyKit; Supabase helpers appear to be legacy/unused in current game flow
- `zustand` 5.0.12 - State management library; listed as dependency but no `from 'zustand'` imports found in `src/` — appears unused or reserved for future use
- `uuid` 13.0.0 - Session ID generation; used in `src/hooks/useGame.ts` (`v4 as uuid`)
- `framer-motion` 12.38.0 - Animation library; used in `src/components/lobby/Lobby.tsx`, `src/components/lobby/WaitingRoom.tsx`, `src/components/ui/Modal.tsx`, `src/components/game/PlayerHand.tsx`

**Utilities:**
- `clsx` 2.1.1 - Conditional className utility; used in `src/components/ui/Button.tsx`, multiple game components
- `@types/uuid` 10.0.0 - TypeScript types for uuid

## Configuration

**Environment:**
- `.env.local` file present (contents not read)
- Key vars required by source code:
  - `VITE_SUPABASE_URL` — consumed in `src/lib/supabase.ts`
  - `VITE_SUPABASE_ANON_KEY` — consumed in `src/lib/supabase.ts`
  - `VITE_PARTYKIT_HOST` — consumed in `src/hooks/useGame.ts`; falls back to `nfart-auction.laulpogan.partykit.dev` in production and `localhost:1999` in dev
- All frontend env vars are Vite-prefixed (`VITE_`) and exposed via `import.meta.env`

**Build:**
- `vite.config.ts` — Vite config; plugins: `@vitejs/plugin-react`, `@tailwindcss/vite`
- `tsconfig.json` — Root references `tsconfig.app.json` and `tsconfig.node.json`
- `tsconfig.app.json` — Frontend TypeScript config; target `ES2023`, JSX `react-jsx`, strict unused-locals enforcement
- `partykit.json` — PartyKit server config; main entry `party/server.ts`, compatibilityDate `2024-11-01`
- `eslint.config.js` — Flat ESLint config; TypeScript-ESLint + react-hooks + react-refresh rules

## Linting

**Tools:**
- ESLint 9.39.4 with `typescript-eslint` 8.58.0
- `eslint-plugin-react-hooks` 7.0.1
- `eslint-plugin-react-refresh` 0.5.2
- Config: `eslint.config.js` (flat config format)

## Platform Requirements

**Development:**
- Node.js v25+ (detected)
- `npm run dev` — starts Vite dev server
- PartyKit dev: `npx partykit dev` (runs on `localhost:1999`)

**Production:**
- Frontend: static build via `npm run build` (outputs to `dist/`)
- Backend: deployed to `partykit.dev` cloud (`nfart-auction.laulpogan.partykit.dev`)

---

*Stack analysis: 2026-04-06*

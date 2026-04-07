# External Integrations

**Analysis Date:** 2026-04-06

## APIs & External Services

**Realtime Multiplayer:**
- PartyKit — WebSocket server platform for real-time multiplayer game state
  - SDK/Client: `partykit` (server, `^0.0.115`), `partysocket` (client, `^1.1.16`)
  - Server implementation: `party/server.ts`
  - Client connection: `src/hooks/useGame.ts`
  - Production endpoint: `nfart-auction.laulpogan.partykit.dev` (hardcoded fallback in `src/hooks/useGame.ts:10`)
  - Dev endpoint: `localhost:1999`
  - Auth: None — sessions identified by UUID stored in `localStorage` under key `ma_session_id`
  - Room model: one PartyKit room per game code; room ID is the lowercase game code

## Data Storage

**Databases:**
- Supabase (PostgreSQL) — client configured in `src/lib/supabase.ts`
  - Connection: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` env vars
  - Client: `@supabase/supabase-js` createClient
  - Tables accessed: `ma_games`, `ma_players`
  - Status: Helper functions exist (`getGame`, `getGameByCode`, `getPlayers`, `getMyPlayer`, `updateGame`, `updatePlayer`, `updateAllPlayers`) but are NOT called by the active game flow. The game was migrated from Supabase to PartyKit (see `supabase_migration.sql` at repo root). These helpers are legacy/dead code.
  - Realtime config: `{ params: { eventsPerSecond: 10 } }` set on client creation

**PartyKit Durable Storage:**
- PartyKit room storage (`this.room.storage`) is used as the authoritative game state store in `party/server.ts`
  - Key: `'state'` — stores the full `ServerState` (game, hands, sessions) per room
  - This is the active persistence mechanism replacing Supabase

**File Storage:**
- Static assets served from `public/` and `src/assets/` (local only, no cloud storage)

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- None — no formal authentication system
  - Implementation: Session identity is a UUID (`v4`) generated on first visit and persisted to `localStorage['ma_session_id']` — see `src/hooks/useGame.ts:14-18`
  - Host status stored in `sessionStorage` under key `host_${roomCode}` — see `src/hooks/useGame.ts:43`
  - PartyKit connection ID (`conn.id`) is the sessionId, passed as the `id` option to `PartySocket`

## Monitoring & Observability

**Error Tracking:**
- None

**Logs:**
- No structured logging; server errors are caught in `party/server.ts` `onMessage` and sent back to the client as `{ type: 'ERROR', message }` messages

## CI/CD & Deployment

**Hosting:**
- Frontend: Not explicitly configured; `dist/` output from `vite build` suitable for any static host
- Backend: PartyKit cloud — `nfart-auction.laulpogan.partykit.dev` (deployed via `partykit deploy`)

**CI Pipeline:**
- None detected

## Environment Configuration

**Required env vars (frontend):**
- `VITE_SUPABASE_URL` — Supabase project URL (legacy, used by `src/lib/supabase.ts` only)
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key (legacy)
- `VITE_PARTYKIT_HOST` — Production PartyKit host; if omitted, falls back to `nfart-auction.laulpogan.partykit.dev`

**Secrets location:**
- `.env.local` (gitignored, present at project root)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## WebSocket Message Protocol

Communication between `src/hooks/useGame.ts` (client) and `party/server.ts` (server) uses a custom JSON message protocol over WebSocket:

**Client → Server messages:**
- `JOIN` — `{ type, name, isHost }`
- `START_GAME` — `{ type }`
- `PLAY_CARD` — `{ type, card }`
- `PLAY_SECOND_CARD` — `{ type, card }`
- `SET_FIXED_PRICE` — `{ type, price }`
- `ACCEPT_FIXED_PRICE` — `{ type }`
- `PASS_FIXED_PRICE` — `{ type }`
- `PLACE_OPEN_BID` — `{ type, amount }`
- `END_OPEN_AUCTION` — `{ type }`
- `PLACE_ONCE_AROUND_BID` — `{ type, amount }`
- `SUBMIT_SEALED_BID` — `{ type, amount }`

**Server → Client messages:**
- `GAME_STATE` — `{ type, game: GameState }` — broadcast to all connections
- `YOUR_HAND` — `{ type, hand: Card[] }` — sent privately per connection
- `ROUND_END` — `{ type, result: RoundResult }` — broadcast to all
- `ERROR` — `{ type, message: string }` — sent to offending connection only

---

*Integration audit: 2026-04-06*

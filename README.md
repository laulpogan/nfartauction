# NFArt Auction

A snarky multiplayer browser implementation of Reiner Knizia's *Modern Art* (1992),
wrapped by a daily gallery sim. 2–4 players, no install, all in the browser.

Tech: TypeScript + React 19 + Vite + Tailwind v4 + PartyKit (authoritative server on
Cloudflare Workers / Durable Objects).

## Local development

```bash
npm install
npm run dev          # Vite dev server (frontend)
npx partykit dev     # PartyKit server (multiplayer backend)
```

The frontend reads `VITE_PARTYKIT_HOST` from `.env.local`. For local dev leave it
unset and the client will connect to `127.0.0.1:1999` (PartyKit's default).

## Tests

```bash
npm test             # vitest run
npx tsc --noEmit     # type check
```

## Deployment

The game is deployed as two pieces: a PartyKit backend (WebSocket server + Durable
Objects) and a static frontend on Cloudflare Pages.

### 1. Server — PartyKit

```bash
npx partykit deploy
```

This deploys `party/server.ts` to `nfart-auction.laulpogan.partykit.dev` (the project
name is set in `partykit.json`). Run once whenever the server code changes.

### 2. Frontend — Cloudflare Pages

```bash
npm run build
```

This produces a static bundle in `dist/`. Two ways to ship it:

**Option A — Manual upload**
Drag the `dist/` directory into the Cloudflare Pages dashboard ("Direct Upload"
project).

**Option B — Git integration**
Connect the repo to a Cloudflare Pages project with:
- **Build command:** `npm run build`
- **Build output directory:** `dist`

SPA routing is handled by `public/_redirects` (`/* /index.html 200`), which Vite
copies into `dist/` automatically.

### Required environment variables

Set on the Cloudflare Pages project (Settings → Environment variables):

| Name                 | Value                                       |
| -------------------- | ------------------------------------------- |
| `VITE_PARTYKIT_HOST` | `nfart-auction.laulpogan.partykit.dev`      |

No Supabase or database credentials are required — PartyKit Durable Objects hold all
game state.

## Project structure

```
party/server.ts        PartyKit Durable Object (authoritative game server)
src/lib/engine.ts      Pure auction engine (state-in / state-out, fully tested)
src/lib/deck.ts        Card deck and dealing
src/components/game/   React game UI
src/hooks/useGame.ts   WebSocket client wrapper around partysocket
public/_redirects      Cloudflare Pages SPA fallback
partykit.json          PartyKit project config
```

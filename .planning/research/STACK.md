# Technology Stack

**Project:** NFArt — Modern Art multiplayer board game + gallery sim
**Researched:** 2026-04-06
**Overall confidence:** HIGH (core stack locked by constraints; research focused on gaps)

---

## Locked Stack (No Changes Required)

The project constraints explicitly freeze the core runtime. Do not propose alternatives to these.

| Technology | Current Version | Status | Notes |
|------------|-----------------|--------|-------|
| TypeScript | ~6.0.2 | LOCKED | All source, strict mode |
| React | 19.2.4 | LOCKED | No SSR, browser only |
| Vite | 8.0.4 | LOCKED | Build + dev server |
| Tailwind CSS | 4.2.2 | LOCKED | Utility styling |
| PartyKit | 0.0.115 | LOCKED | Authoritative WebSocket server on Cloudflare edge |
| PartySocket | 1.1.16 | LOCKED | Client-side socket lifecycle |
| React Router DOM | 7.14.0 | LOCKED | Client-side routing |

---

## Recommended Stack (Gaps to Fill)

### State Management — Client-Side Sim Layer

**Verdict: Activate zustand 5 with persist middleware. Do not introduce a second state library.**

Zustand 5.0.12 is already installed. It is unused because the auction engine routes all state through the PartyKit WebSocket, which is correct for authoritative game state. The sim layer is different: it has per-player ephemeral UI state (which time slot is selected, animation states, inventory drawer open/closed) and per-player local state that persists between sessions (relationship scores, faction rep, drug inventory, landlord stage). These do not belong in the PartyKit Durable Object because they are not authoritative game state — they are player-side sim bookkeeping.

Use zustand for both concerns via two stores:

**Store 1: `useSimSessionStore`** — ephemeral, in-memory
- Selected time slot, active neighborhood, UI overlay state
- Do NOT persist. Rebuilt from server state on reconnect.

**Store 2: `useSimPlayerStore`** — persisted to localStorage via zustand `persist` middleware
- Relationship scores (named NPCs), faction alignment, drug inventory, landlord stage, NFT unlock flag
- Key: `nfart_sim_{roomCode}_{sessionId}` — scopes to player+room
- Partialize to exclude derived values; store only source-of-truth primitives

Why not jotai: Jotai's atomic model is better when state decomposition is fine-grained and components subscribe to individual atoms. The sim layer has 6–8 grouped domains (relationships, inventory, factions, etc.) — a flat zustand store with slices is simpler to reason about and easier to serialize with persist.

Why not valtio: Proxy mutation is harder to audit for correctness in a game where state transitions need to be traceable. The existing codebase is pure-functional; zustand's explicit set() calls match that discipline better.

```bash
# Already installed — no install needed
# zustand 5.0.12 is in package.json
```

Confidence: HIGH (zustand docs confirm persist middleware, partialize, custom storage key patterns)

---

### Input Validation — WebSocket Messages

**Verdict: Add Zod 4 (not Zod 3). Apply to all inbound server.onMessage paths.**

The PROJECT.md explicitly lists "Input validation on all WebSocket message types (Zod or equivalent)" as a required active task. The current server has no validation — all message type handling trusts client-provided fields.

Use Zod 4 (`zod@^4.0.0`). Zod 4 was released in 2025 and ships 14x faster string parsing, 7x faster array parsing, 2x smaller bundle, and 100x fewer TypeScript instantiations than Zod 3. The performance delta matters on a Cloudflare Worker budget. PartyKit's own documentation recommends Zod for input validation in the server's onMessage handler.

Define a discriminated union schema for all message types in `src/types/messages.ts` and share it between server and client. The server parses with `z.parse()` (throws on invalid input, caught by existing try/catch). The client uses the same schemas to type its send helpers in `useGame.ts`.

Do not use `@ws-kit/zod` or `zod-sockets` — those are adapters for different WebSocket runtimes and add indirection without benefit here.

```bash
npm install zod@^4
```

Confidence: HIGH (Zod 4 released August 2025, PartyKit docs reference Zod explicitly for this use case)

---

### Animation — Auction Type Visual Skins

**Verdict: Keep framer-motion 12 (installed). Do NOT migrate to `motion` package yet. Use CSS keyframes for receipt/print effects.**

framer-motion 12 (the installed package, version 12.38.0) was renamed to `motion` with the `motion/react` import path in 2025 when Framer spun it off as an independent project. The `framer-motion` package on npm now re-exports from `motion` as a compatibility shim — it still works. Migration is a one-line import change (`"framer-motion"` → `"motion/react"`), so defer it until a dedicated refactor milestone to avoid churn during active feature development.

Use framer-motion for:
- Card reveal animations (sealed bid → reveal): `rotateY` flip, `AnimatePresence` for mount/unmount
- Auction panel transitions between types (variants with `staggerChildren`)
- Bid placement feedback (scale pulse on `PlayerList` money display)
- Modal enter/exit (already in use for `Modal.tsx`)

Use plain CSS `@keyframes` (via Tailwind arbitrary values or `src/index.css`) for:
- Receipt "print" effect (vertical reveal with clip-path or height animation — CSS is simpler and cheaper here)
- Typewriter text for appraisal document end screen
- Flickering accent in the Online neighborhood (text-shadow cycling, not layout — pure CSS)
- Wall-label static typography — no animation, just typographic CSS

Do NOT use framer-motion's `layoutId` or `AnimateSharedLayout` for the main game board — these have known performance cost at 60fps+ when many elements are in the DOM simultaneously. Prefer explicit enter/exit variants.

Confidence: MEDIUM (framer-motion 12 npm page confirms shim, motion.dev docs confirm migration path; game-specific perf claim is training-data inference, not benchmarked)

---

### Serialization — Complex Types Over the Wire

**Verdict: Do not use superjson. Keep plain JSON.stringify with explicit toJSON helpers.**

The current codebase serializes `GameState` as plain JSON over WebSocket. The sim layer will need to serialize Maps (relationship scores keyed by NPC id) and possibly Sets (faction memberships). Do not reach for superjson — it adds 15KB to the bundle and a non-obvious wire format that complicates debugging.

Instead, use plain TypeScript records (`Record<string, number>` for relationship scores, `string[]` for faction memberships). This is already consistent with how `GameState.players` is serialized. Zustand's persist middleware will serialize these to localStorage without issue.

If PartyKit storage needs to hold per-player sim state server-side in future (v2 narrative expansion), revisit at that point.

Confidence: HIGH

---

### Testing — Pure Functional Game Engine

**Verdict: Add Vitest 4 + @testing-library/react. No Jest. No Playwright at this stage.**

Vitest 4.1 is the current stable release (April 2026). It ships with Browser Mode stable, visual regression, and Playwright Traces. For this project, only the unit test runner is needed now — Browser Mode and visual regression are v2 concerns.

The engine layer (`src/lib/engine.ts`, `src/lib/deck.ts`) is pure functional with zero side effects. This is the ideal target for Vitest unit tests:

- Zero mocking required — functions take state in, return state out
- Test all five auction resolution paths, round-end trigger, sealed bid tie-breaking, double auction second-card enforcement
- Property-based tests for `shuffle` (deck length invariant, no duplicates)

Setup:
```bash
npm install -D vitest@^4 @vitest/ui@^4 @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

Vitest config in `vite.config.ts`:
```ts
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts'],
}
```

File placement: `src/lib/engine.test.ts`, `src/lib/deck.test.ts`. Do NOT use Vitest in-source testing (`if (import.meta.vitest)`) — the engine is already a clean module boundary, colocating tests inside source files adds noise.

Do NOT add Playwright or Cypress now. End-to-end WebSocket testing of a PartyKit server requires a running server instance and is a phase 3+ concern. Unit tests on the pure engine are the immediate return.

Why not Jest: Jest requires a Babel/ts-jest transform pipeline in a Vite project; Vitest uses the same esbuild pipeline as Vite, so TypeScript just works with zero config overhead. Vitest is now the clear default for Vite-based TypeScript projects.

Confidence: HIGH (Vitest 4.1.2 confirmed on npm; React Testing Library compatibility with React 19 confirmed in community discussion)

---

### Deployment — Static Frontend + PartyKit Server

**Verdict: Cloudflare Pages for frontend. PartyKit cloud for server. No changes needed to architecture.**

PartyKit was acquired by Cloudflare in 2024. The `npx partykit deploy` command deploys to `*.partykit.dev` — a managed Cloudflare Workers/Durable Objects environment. This is already operational (`nfart-auction.laulpogan.partykit.dev`).

For the static frontend, use Cloudflare Pages:
- Free tier: unlimited bandwidth, 500 builds/month, 300+ CDN nodes
- Native support for Vite React projects (framework preset or manual `npm run build` → `dist/`)
- Required: add `public/_redirects` with `/* /index.html 200` for client-side routing
- Environment variable: `VITE_PARTYKIT_HOST` set in Cloudflare Pages dashboard (not `.env.local`)
- Remove `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from dashboard — they are no longer needed

Why Cloudflare Pages over Vercel/Netlify: The PartyKit server is already on Cloudflare infrastructure. Keeping the frontend on Cloudflare Pages means WebSocket handshakes and CORS headers share the same CDN edge, minimizing latency. Same-vendor deployment also simplifies access control if the project ever uses Cloudflare Access.

The `app/` subdirectory artifact (duplicate of the root) should be deleted before deploying — the Cloudflare Pages build must point to the root `package.json` and `dist/`, not the duplicate.

Confidence: HIGH (Cloudflare Pages Vite deployment is well-documented; PartyKit acquisition confirmed)

---

### Removed Dependencies

| Package | Action | Reason |
|---------|--------|--------|
| `@supabase/supabase-js` | Remove | Backend is PartyKit; Supabase file is dead code; PROJECT.md explicitly requires removal |
| `src/lib/supabase.ts` | Delete | Not imported anywhere; holding stale credentials requirement |
| Orphaned SQL files | Delete | No DB in the active architecture |

```bash
npm uninstall @supabase/supabase-js
```

---

## Complete Recommended Dependency Delta

```bash
# Add
npm install zod@^4

# Add (dev)
npm install -D vitest@^4 @vitest/ui@^4 @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom

# Remove
npm uninstall @supabase/supabase-js
```

**zustand** (5.0.12) — already installed, activate it
**framer-motion** (12.38.0) — already installed, use it as-is

---

## Alternatives Considered and Rejected

| Category | Recommended | Rejected | Reason |
|----------|-------------|----------|--------|
| State management | zustand 5 (persist) | jotai | Atom granularity is overkill for 6–8 grouped sim domains; zustand already installed |
| State management | zustand 5 (persist) | valtio | Proxy mutation is harder to audit in a pure-functional codebase; no performance advantage here |
| State management | zustand 5 (persist) | Redux Toolkit | Significant boilerplate overhead; no need for time-travel debugging in a sim |
| Validation | Zod 4 | Valibot | Valibot is smaller but ecosystem tooling (IDE, PartyKit docs) references Zod; not worth switching |
| Validation | Zod 4 | Custom type guards | Maintainability: Zod schemas are the single source of truth for message shapes |
| Testing | Vitest 4 | Jest | Vite project; Jest requires additional transform config; Vitest is zero-config here |
| Testing | Vitest 4 | Playwright | E2E against live WebSocket is out of scope for the current engine-hardening phase |
| Serialization | Plain JSON records | superjson | Bundle cost and non-obvious wire format; problem is solvable with TypeScript types |
| Animation | framer-motion (keep) | react-spring | framer-motion already installed, already used in 4 components; no migration benefit |
| Animation | framer-motion (keep) | GSAP | Licensing cost (GSAP Pro for some features); overkill for board game animation fidelity |
| Frontend hosting | Cloudflare Pages | Vercel | Same CDN as PartyKit server; reduces cross-vendor WebSocket latency |
| Frontend hosting | Cloudflare Pages | Netlify | Same rationale as Vercel; no technical gap that would favor Netlify |

---

## What NOT to Add (Hard Stops)

**tRPC** — All client-server communication is WebSocket JSON messages, not HTTP RPC. tRPC adds a type-safe HTTP layer that duplicates what the typed message union already provides. Do not add.

**React Query / TanStack Query** — No REST API, no HTTP data fetching. Server state arrives via WebSocket push. Do not add.

**Prisma / Drizzle / any ORM** — No database in the architecture. PartyKit Durable Object storage is the persistence layer for authoritative state. Do not add.

**Socket.io** — PartySocket is the PartyKit-native client. Socket.io is a different protocol. Do not mix.

**Canvas / WebGL** — Explicit out-of-scope in PROJECT.md. Browser 2D CSS/HTML only.

**Next.js / Remix** — SERVER-SIDE RENDERING IS OUT OF SCOPE. The project is a SPA served from static hosting. Do not add a framework that implies SSR.

---

## Sources

- Zustand persist middleware: https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data
- Zod 4 release notes and performance: https://www.infoq.com/news/2025/08/zod-v4-available/ and https://zod.dev/v4
- PartyKit validating client inputs (recommends Zod): https://docs.partykit.io/guides/validating-client-inputs/
- PartyKit persisting state: https://docs.partykit.io/guides/persisting-state-into-storage/
- Motion (framer-motion rename): https://motion.dev/docs/react-upgrade-guide and https://fireup.pro/news/framer-motion-becomes-independent-introducing-motion
- Vitest 4 release: https://vitest.dev/blog/vitest-4 and https://voidzero.dev/posts/announcing-vitest-4
- Cloudflare Pages + Vite React deploy: https://developers.cloudflare.com/workers/framework-guides/web-apps/react/
- PartyKit acquired by Cloudflare: https://blog.partykit.io/posts/partykit-is-joining-cloudflare/
- Zustand vs Jotai vs Valtio 2025: https://www.reactlibraries.com/blog/zustand-vs-jotai-vs-valtio-performance-guide-2025
- framer-motion vs CSS animations: https://tillitsdone.com/blogs/framer-motion-vs-css-in-react/

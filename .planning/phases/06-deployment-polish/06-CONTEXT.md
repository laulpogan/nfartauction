# Phase 6: Deployment & Polish - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Source:** Final phase, derived from PROJECT.md deployment requirements

<domain>
## Phase Boundary

The final phase. Get the game deployed to a public URL, clean up the duplicate `app/` directory artifact, verify no Supabase credentials are needed for production deploy.

In scope:
- Delete duplicate `app/` subdirectory (root is canonical — confirmed by `partykit.json` pointing to `party/server.ts`)
- Cloudflare Pages deployment configuration for the static frontend (`VITE_PARTYKIT_HOST` env var, SPA redirects)
- PartyKit production deployment verification (`npx partykit deploy`)
- Verify no Supabase env vars are referenced anywhere
- Final smoke test: full game loop from public URL

Out of scope (post-v1):
- Custom domain
- Performance optimization beyond what's already in the build
- CI/CD pipeline (manual deploy is fine for v1)

</domain>

<decisions>
## Implementation Decisions

### Cleanup
- Delete the nested `/Users/laul_pogan/Source/nfartauction/app/app/` directory entirely
- Verify `partykit.json` points at `party/server.ts` (root, not `app/party/server.ts`)
- Verify no remaining Supabase references in code or env files

### Deployment Targets
- **Frontend**: Cloudflare Pages (same CDN as PartyKit, minimizes WebSocket handshake latency)
- **Server**: PartyKit production at `nfart-auction.laulpogan.partykit.dev` (already configured in `vite.config.ts` env defaults)
- Static build via `npm run build` → `dist/`
- SPA routing: add `public/_redirects` with `/* /index.html 200`

### Environment
- Required production env: `VITE_PARTYKIT_HOST=nfart-auction.laulpogan.partykit.dev`
- Removed: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Supabase already deleted in Phase 1)
- `partykit.json` config already valid

### README Update
- Update README.md with deployment instructions (build + partykit deploy + Cloudflare Pages)
- Document game running URL once deployed

### Smoke Test
- Manual verification: open public URL, create room, join from second browser, complete a round, verify state syncs

### Claude's Discretion
- Whether to run `npx partykit deploy` (requires user credentials) or document the command for the user
- Cloudflare Pages config can be documented vs auto-applied (depends on whether wrangler is available)

</decisions>

<canonical_refs>
## Canonical References

- `.planning/PROJECT.md` — DEPLOY-01, DEPLOY-02, DEPLOY-03
- `.planning/REQUIREMENTS.md`
- `.planning/codebase/CONCERNS.md` — duplicate `app/` directory finding
- `partykit.json` — server config
- `vite.config.ts` — frontend build config
- `package.json` — scripts

</canonical_refs>

<specifics>
## Specific Ideas

- README sections to add:
  ```
  ## Deployment

  ### Server (PartyKit)
  npx partykit deploy

  ### Frontend (Cloudflare Pages)
  npm run build
  # then upload dist/ to Cloudflare Pages or connect git repo
  ```

- public/_redirects content:
  ```
  /*    /index.html   200
  ```

</specifics>

<deferred>
## Deferred Ideas

- CI/CD with GitHub Actions (v2)
- Custom domain (v2)
- Analytics (v2)

</deferred>

---

*Phase: 06-deployment-polish*
*Context gathered: 2026-04-06*

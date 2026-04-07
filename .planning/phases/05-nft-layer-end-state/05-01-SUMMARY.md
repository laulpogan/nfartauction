---
phase: 05-nft-layer-end-state
plan: 01
subsystem: nft-parallel-economy
tags: [nft, sim-engine, server, ui, online-neighborhood]
requirements: [NFT-01, NFT-02, NFT-03, NFT-04, NFT-05]
dependency_graph:
  requires:
    - src/types/game.ts (Phase 3-4 PlayerSimState/SimState)
    - src/lib/sim-engine.ts (updateRelationship, advanceDay, drift parameter)
    - src/lib/sim-config.ts (createInitialPlayerSimState)
    - src/components/aesthetic/OnlineNeighborhood.tsx (Phase 2 wrapper)
    - src/components/aesthetic/AppraisalForm.tsx (Phase 2 primitive)
    - party/server.ts (advanceFromSimDay, entropy boundary)
  provides:
    - NftRarity, NftItem, NftDmMessage, NftDenouncementMessage types
    - PlayerSimState.nftWallet/nftWalletUnlocked/heldNfts
    - NFT_CONFIG, NFT_ITEM_DEFINITIONS
    - convertNft, purchaseNftWhitelist, applyNftHypeDrift, computeNftExchangeRate
      (all pure; server-owned entropy)
    - CONVERT_NFT and PURCHASE_NFT_WHITELIST Zod variants + handlers
    - Coolness threshold-cross detector inside advanceFromSimDay
    - applyNftHypeDrift wiring on the advanceDay drift parameter
    - NftPanel React component (wrapped in OnlineNeighborhood)
    - useGame.actions.convertNft / purchaseNftWhitelist
  affects:
    - src/components/sim/SimPanel.tsx (renders NftPanel after DrugInventory)
    - src/pages/GamePage.tsx (forwards new actions)
    - src/components/sim/SimPanel.test.tsx (fixture backfill)
tech-stack:
  added: []
  patterns:
    - "Server-owned entropy boundary, again: Math.random and crypto.randomUUID
       live in party/server.ts only. The pure engine receives the projected
       hype value (via applyNftHypeDrift) and the constructed NftItem (via
       purchaseNftWhitelist), keeping the determinism story intact."
    - "Coolness threshold cross is detected by snapshotting prior coolness
       BEFORE resolveSlots and comparing against the post-drug-use coolness.
       The unlock bit is server-only — no inbound message can flip it
       (T-5-05). NFT_DM is unicast via per-connection lookup, mirroring the
       broadcastSimStatePrivate iteration (T-5-07)."
    - "applyNftHypeDrift returns a clamped projection; the server computes
       the delta (next - current) and passes that to advanceDay so the
       existing drift contract is preserved while the engine still does the
       final clamp through applyGlobalStatDrift."
    - "Faction reactions iterate the relationships array exactly once and
       use the existing updateRelationship helper — no new mutation surface
       for opponents to influence (T-5-06). The denouncement broadcast
       fires only when a social_political relationship was actually hit."
    - "NftPanel wraps its content in <OnlineNeighborhood> which engages the
       Phase 2 broken-font + accent-flicker aesthetic for the panel subtree
       only — the rest of SimPanel keeps its straight gallery register."
key-files:
  created:
    - src/components/sim/NftPanel.tsx
    - src/components/sim/NftPanel.test.tsx
  modified:
    - src/types/game.ts
    - src/lib/sim-config.ts
    - src/lib/sim-engine.ts
    - src/lib/sim-engine.test.ts
    - src/lib/server-schemas.test.ts
    - src/components/sim/SimPanel.tsx
    - src/components/sim/SimPanel.test.tsx
    - src/hooks/useGame.ts
    - src/pages/GamePage.tsx
    - party/server.ts
decisions:
  - "convertNft accepts amount + exchangeRate as parameters and computes
     moneyDelta = floor(amount * rate). Rate is computed at the call site
     (server reads sim.nftHypeCycle, NftPanel re-derives via
     computeNftExchangeRate). Keeps the engine free of any sim global lookup."
  - "purchaseNftWhitelist's item argument is nullable. The server represents
     a 50/50 'miss' by passing null — the cost is still debited but heldNfts
     is unchanged. This keeps the pure engine from needing its own RNG and
     mirrors the addDrugItem entropy boundary."
  - "Threshold-cross detector runs AFTER drug-use, not after resolveSlots —
     a party slot with a drug consumes the highest coolness moment of the
     day, and that's the moment the unlock should fire on. The check uses
     a Map<sessionId, priorCoolness> snapshotted at the very top of
     advanceFromSimDay before any mutation."
  - "CONVERT button calls onConvert with the FULL nftWallet balance for now
     (no amount picker). The plan calls this out as the explicit user action
     for NFT-04; a partial-conversion picker is deferred."
  - "NFT denouncement template uses {name} interpolation rather than a
     formatter function so the copy lives entirely in sim-config and the
     server is just doing a string replace. Trivial to localize later."
metrics:
  duration: ~4min
  tasks: 2
  files_changed: 12
  tests_added: 31
  total_tests: 220
  completed: 2026-04-06
---

# Phase 5 Plan 01: NFT Parallel Economy Summary

The NFT parallel economy: a Coolness-gated wallet, hype-driven exchange
rate, explicit conversion + whitelist-purchase messages, faction reactions,
and the OnlineNeighborhood-wrapped UI panel that surfaces all of it. Closes
NFT-01..NFT-05. The sim-engine stays absolutely pure; entropy lives in
party/server.ts.

## What Shipped

### Task 1 — Types + sim-config + pure engine functions (commit `48a0305`)

**`src/types/game.ts`** — Added `NftRarity` (`common | uncommon | rare |
legendary`), `NftItem { id, rarity, displayLabel, displayMeta, baseValue }`,
and outbound message stubs `NftDmMessage` / `NftDenouncementMessage`. On
`PlayerSimState`:

```typescript
nftWallet: number
nftWalletUnlocked: boolean
heldNfts: NftItem[]
```

**`src/lib/sim-config.ts`** — `NFT_CONFIG`:

```typescript
export const NFT_CONFIG = {
  unlockThreshold: 60,
  initialWallet: 5,
  whitelistCost: 2,
  hypeDriftRange: 10,
  sculptorReactionDelta: -3,
  socialPoliticalReactionDelta: -5,
  dmCopy: "you've crossed the threshold. welcome to the chain. — anonymous",
  denouncementCopyTemplate: "{name} just minted. the museum shouldn't be a server farm.",
} as const
```

Plus `NFT_ITEM_DEFINITIONS` with 4 rarity tiers in wall-label register
("Untitled (PFP #4421)", "Avatar (Series III)", "Untitled (Glass)", "Crown
(1/1)") and `createInitialPlayerSimState` extended to seed `nftWallet=5`,
`nftWalletUnlocked=false`, `heldNfts=[]`.

**`src/lib/sim-engine.ts`** — Four pure functions, no `Math.random` /
`Date.now` / `console` in any function body:

- `convertNft(playerSim, amount, rate)` — debits `nftWallet` and returns
  `{ updatedPlayerSim, moneyDelta = floor(amount * rate) }`. Rejects with
  unchanged input + `moneyDelta=0` on overdraft, zero, or negative amount.
- `purchaseNftWhitelist(playerSim, item | null)` — debits
  `NFT_CONFIG.whitelistCost`, appends `item` if non-null. Returns input
  unchanged when `nftWallet < whitelistCost` (defense in depth).
- `applyNftHypeDrift(currentHype, randomDelta)` — returns clamped
  `[0, 100]` projection. The caller (server) supplies the random delta.
- `computeNftExchangeRate(nftHypeCycle)` — returns
  `0.5 + (nftHypeCycle / 100) * 1.5` → range `[0.5, 2.0]`.

`NFT_CONFIG` and `NFT_ITEM_DEFINITIONS` are re-exported from `sim-engine`
alongside the existing `DRUG_CONFIG` re-export so callers can pull from a
single module.

**`src/lib/sim-engine.test.ts`** — 15 new cases under "NFT system":

- `computeNftExchangeRate`: boundaries at hype 0/50/100 (0.5/1.25/2.0)
- `applyNftHypeDrift`: positive delta, clamp at 100, clamp at 0
- `convertNft`: happy path, overdraft rejection, amount=0 rejection,
  negative amount rejection, purity (no input mutation)
- `purchaseNftWhitelist`: hit (debits + appends), miss (debits only),
  insufficient balance (no-op), purity

**`src/components/sim/SimPanel.test.tsx`** — Fixture backfilled with
`nftWallet: 5`, `nftWalletUnlocked: false`, `heldNfts: []` to satisfy the
extended `PlayerSimState` type.

### Task 2 — Server handlers + threshold detection + NftPanel UI (commit `726ee5f`)

**`party/server.ts`** — Two new InboundMessage variants:

```typescript
z.object({ type: z.literal('CONVERT_NFT'), amount: z.number().int().min(1).max(1000) }),
z.object({ type: z.literal('PURCHASE_NFT_WHITELIST') }),
```

**CONVERT_NFT handler:** gates on phase (`sim_day` or `auction_round`),
known session, and `playerSim.nftWalletUnlocked`. Calls `convertNft` with
the rate from `computeNftExchangeRate(sim.nftHypeCycle)`, mirrors
`moneyDelta` onto `game.players[i].money`, runs `syncSessions`, persists,
broadcasts public state, and unicasts an updated `YOUR_SIM_STATE`.

**PURCHASE_NFT_WHITELIST handler:** same gating, plus `nftWallet >=
whitelistCost`. Server-side roll: `Math.random() < 0.5` picks a uniform
`NftRarity`, generates `id` via `crypto.randomUUID()` (with the same
`Date.now+Math.random` fallback drug acquisition uses), constructs the
NftItem from `NFT_ITEM_DEFINITIONS[rarity]`, and calls
`purchaseNftWhitelist(ps, item)`. On a miss, calls with `null` (cost still
debited). Then iterates `relationships` once, applying
`updateRelationship(-3)` to every Sculptor and `updateRelationship(-5)` to
every Social/Political character. If at least one social_political
relationship was hit, broadcasts `NFT_DENOUNCEMENT` to the room with the
formatted copy.

**Threshold-cross detector inside `advanceFromSimDay`:** snapshots
`priorCoolnessBySession` BEFORE `resolveSlots` runs, then after the
drug-use pass (the highest-coolness moment of the day) compares prior vs
current against `NFT_CONFIG.unlockThreshold`. On a fresh cross, sets
`nftWalletUnlocked = true` and unicasts `NFT_DM` to the connection whose
`conn.id === sessionId`. Mirrors `broadcastSimStatePrivate`'s connection
iteration pattern.

**Hype drift wiring:** the hardcoded `nft: 0` drift was replaced with:

```typescript
const nftRandomDelta = (Math.random() * 2 - 1) * NFT_CONFIG.hypeDriftRange
const nextHype = applyNftHypeDrift(sim.nftHypeCycle, nftRandomDelta)
const { updatedSim, updatedPlayerSims } = advanceDay(
  sim,
  Object.values(updatedPlayerSimMap),
  { hotness: 0, gent: 0, nft: nextHype - sim.nftHypeCycle },
  contactedByPlayer,
)
```

`applyGlobalStatDrift` then applies the (already-clamped) delta to the
sim, so the value is double-clamped — defense in depth.

**`src/components/sim/NftPanel.tsx`** — New component.

```typescript
export interface NftPanelProps {
  playerSim: PlayerSimState | null
  nftHypeCycle: number
  onConvert: (amount: number) => void
  onPurchase: () => void
}
```

Returns `null` when `playerSim == null` OR `!playerSim.nftWalletUnlocked`
(the conditional render gate per the plan). Otherwise wraps an
`AppraisalForm` titled "NFT WALLET" / "FORM N-13" inside an
`<OnlineNeighborhood>` so the broken-font + accent-flicker aesthetic
activates for the panel subtree only. Rows: WALLET (emphasis), RATE
(`rate.toFixed(2)`), HYPE (rounded), then one row per `heldNfts` item with
the value wrapped in `<span data-nft-id={item.id}>` for test addressing.
Empty holdings render a single `'no holdings'` row.

Two buttons (using existing `Button.tsx`): CONVERT calls
`onConvert(playerSim.nftWallet)` (full balance, per NFT-04 explicit user
action), disabled when `nftWallet === 0`. WHITELIST PURCHASE calls
`onPurchase()`, disabled when `nftWallet < NFT_CONFIG.whitelistCost`.

**`src/components/sim/NftPanel.test.tsx`** — 9 RTL cases: null `playerSim`,
locked, WALLET/RATE/HYPE rendering, `data-nft-id` rows, no-holdings
fallback, CONVERT click + amount, CONVERT disabled at 0, WHITELIST PURCHASE
disabled below cost, WHITELIST PURCHASE click.

**`src/components/sim/SimPanel.tsx`** — Imported `NftPanel` and rendered it
after `DrugInventory` and before `NeighborhoodMap`. Two new optional props
(`convertNft`, `purchaseNftWhitelist`) forward to the panel callbacks.

**`src/hooks/useGame.ts`** — Added two `actions`:

```typescript
convertNft: (amount: number) => send({ type: 'CONVERT_NFT', amount }),
purchaseNftWhitelist: () => send({ type: 'PURCHASE_NFT_WHITELIST' }),
```

**`src/pages/GamePage.tsx`** — Forwards both new actions to `<SimPanel>`.

**`src/lib/server-schemas.test.ts`** — 7 new cases: CONVERT_NFT happy
(amount=10), amount=0 reject, amount=-1 reject, amount=1001 reject (DoS
cap T-5-08), non-integer reject, missing amount reject, and the bare
PURCHASE_NFT_WHITELIST happy path.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run src/lib/sim-engine.test.ts` | 77/77 green (62 prior + 15 new) |
| `npx vitest run` (full regression) | **220/220 green** (189 prior + 31 new) |
| `grep -c "CONVERT_NFT" party/server.ts` | 4 (≥3) |
| `grep -c "PURCHASE_NFT_WHITELIST" party/server.ts` | 4 (≥3) |
| `grep -c "nftWalletUnlocked" party/server.ts` | 7 (≥2) |
| `grep -c "applyNftHypeDrift" party/server.ts` | 3 (≥1) |
| `grep -c "OnlineNeighborhood" src/components/sim/NftPanel.tsx` | 4 (≥2) |
| `grep -c "NftPanel" src/components/sim/SimPanel.tsx` | 2 (≥2) |
| `grep -nE "Math\.random\|Date\.now\|console\." src/lib/sim-engine.ts` (in code) | 0 (all matches in comments) |
| Privacy: `derivePublicState` body `playerSim`/`nftWallet` references | 0 |

## Deviations from Plan

None — plan executed as written. No auth gates, no checkpoints, no
architectural deviations. The only minor variances are:

- **`purchaseNftWhitelist` returns input unchanged on insufficient
  balance**, rather than throwing or returning a result type. This
  matches the engine's existing convention (e.g., `removeDrugItem` is a
  no-op on unknown ids) and keeps the function's return type stable.
- **NftPanel's CONVERT button passes the full `nftWallet` balance** to
  `onConvert`, rather than spawning a separate amount picker. Plan
  explicitly called this out as acceptable for now per NFT-04.

## Threat Mitigations Applied

| Threat | Status | Mechanism |
|--------|--------|-----------|
| T-5-01 (CONVERT_NFT amount tampering) | mitigate | Zod `.int().min(1).max(1000)`; `convertNft` independently rejects `amount > nftWallet` and `amount <= 0`. |
| T-5-02 (whitelist cost bypass) | mitigate | `NFT_CONFIG.whitelistCost` is a server constant; client sends no amount field; handler verifies `nftWallet >= cost` before calling the engine. |
| T-5-03 (CONVERT_NFT unknown session) | mitigate | `state.sessions[sessionId]` lookup; ERROR returned on miss. |
| T-5-04 (nftWallet/heldNfts in public broadcast) | mitigate | Both fields live on `PlayerSimState`. `derivePublicState` body has 0 references to `playerSim` (verified). |
| T-5-05 (nftWalletUnlocked bypass) | mitigate | The bit is set ONLY by the threshold-cross detector inside `advanceFromSimDay`. No inbound message can flip it. CONVERT_NFT and PURCHASE_NFT_WHITELIST handlers both reject when `!nftWalletUnlocked`. |
| T-5-06 (faction reaction bypass) | mitigate | The reaction pass runs unconditionally inside the PURCHASE_NFT_WHITELIST handler — no client field controls it. |
| T-5-07 (NFT_DM leaked to wrong session) | mitigate | Server iterates `room.getConnections()` and only sends `NFT_DM` to the connection where `conn.id === p.sessionId`. |
| T-5-08 (CONVERT_NFT spam) | accept | Zod cap on amount; PartyKit handles message-rate flooding upstream; no per-room state grows unbounded. |
| T-5-09 (hype drift manipulation) | mitigate | `Math.random` for the drift lives only in `party/server.ts`; the engine receives the projected delta. `applyNftHypeDrift` clamps to `[0, 100]`. |
| T-5-10 (NFT activity audit log) | accept | Session-scoped; `logSimTransaction` covers dev-mode playtest. |

## Privacy Guarantees

- `NftPanel` receives only the owning connection's `playerSim`. It never
  touches `game.players[i]` for any `i` and never iterates opponent sim
  state.
- `nftWallet`, `nftWalletUnlocked`, and `heldNfts` live exclusively on
  `PlayerSimState`. `derivePublicState` strips `playerSim` entirely
  (Phase 3 invariant), so they never reach the public projection.
- The threshold-cross unlock is unicast — only the connection whose
  Coolness crossed receives the `NFT_DM` and the next `YOUR_SIM_STATE`
  with `nftWalletUnlocked: true`.
- The `NFT_DENOUNCEMENT` broadcast is intentionally room-wide — that's
  the design (a public denouncement). It only carries `displayName` +
  `copy`, never `nftWallet` or `heldNfts`.

## Known Stubs

None. All NFT paths are live: convertNft, purchaseNftWhitelist (with
faction reactions and denouncement broadcast), threshold-cross detection,
hype drift wiring, NftPanel render gate, and the useGame action wiring
into GamePage. The pure engine has full test coverage; the UI renders
from the authoritative private `playerSim` channel; the server runs the
full pipeline. Everything the plan's `<behavior>` blocks called out is
implemented.

## Commits

- `48a0305` — feat(05-01): add NFT type layer + sim-config + pure engine functions
- `726ee5f` — feat(05-01): wire NFT server handlers + threshold detection + NftPanel UI

## Self-Check: PASSED

Files exist:
- FOUND: src/types/game.ts (extended)
- FOUND: src/lib/sim-config.ts (extended)
- FOUND: src/lib/sim-engine.ts (extended)
- FOUND: src/lib/sim-engine.test.ts (extended)
- FOUND: src/lib/server-schemas.test.ts (extended)
- FOUND: src/components/sim/NftPanel.tsx
- FOUND: src/components/sim/NftPanel.test.tsx
- FOUND: src/components/sim/SimPanel.tsx (modified)
- FOUND: src/components/sim/SimPanel.test.tsx (modified)
- FOUND: src/hooks/useGame.ts (modified)
- FOUND: src/pages/GamePage.tsx (modified)
- FOUND: party/server.ts (modified)

Commits exist:
- FOUND: 48a0305 (Task 1: types + config + engine + tests)
- FOUND: 726ee5f (Task 2: server + threshold + NftPanel + actions)

Tests pass:
- FOUND: 220/220 vitest green (189 prior + 15 NFT engine + 9 NftPanel + 7 schema)
- FOUND: tsc --noEmit exit 0

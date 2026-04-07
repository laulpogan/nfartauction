# Testing Patterns

**Analysis Date:** 2026-04-06

## Test Framework

**Runner:**
- None configured. No `jest.config.*`, `vitest.config.*`, or any test runner dependency exists in `package.json`.

**Assertion Library:**
- Not applicable — no testing framework present.

**Run Commands:**
```bash
# No test scripts defined in package.json
npm run lint    # Only quality check available — runs ESLint
tsc -b          # Type checking via TypeScript compiler (run as part of build)
```

## Test File Organization

**Location:**
- No test files exist anywhere in the codebase (`*.test.*` and `*.spec.*` patterns return zero matches).

**Naming:**
- Not applicable — no convention established.

## Test Structure

**Status:** No tests exist. The codebase has zero test coverage.

The closest thing to automated quality enforcement is:
- TypeScript compiler (`tsc -b`) run as part of `npm run build` — catches type errors
- ESLint (`npm run lint`) — catches code style and React hooks violations
- TypeScript compiler flags: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` — catch common bugs at compile time

## Mocking

**Framework:** Not applicable — no test framework.

## Fixtures and Factories

**Test Data:** Not applicable.

## Coverage

**Requirements:** None enforced.

**Coverage Tool:** Not configured.

## Test Types

**Unit Tests:** None.

**Integration Tests:** None.

**E2E Tests:** None.

## Testability Assessment

Despite having no tests, the codebase has several properties that make it **highly testable** if tests were added:

**Well-suited for unit testing:**
- `src/lib/engine.ts` — all functions are pure (input → output, no side effects). Functions like `playCard`, `endRound`, `resolveAuction`, `submitSealedBid`, `placeOnceAroundBid` contain complex business logic that would benefit greatly from unit tests.
- `src/lib/deck.ts` — `buildDeck`, `shuffle`, `dealHands` are pure utility functions.
- `src/types/game.ts` — exported constants (`ROUND_VALUES`, `HAND_DISTRIBUTION`, `ARTIST_COLORS`) could be validated.

**Recommended test framework to add:**
- Vitest — aligns with the existing Vite build toolchain; minimal config required

**Recommended vitest setup:**
```bash
npm install -D vitest
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

**Example test structure to follow (if tests were added):**
```typescript
// src/lib/engine.test.ts
import { describe, it, expect } from 'vitest'
import { buildDeck } from './deck'
import { playCard, endRound } from './engine'

describe('buildDeck', () => {
  it('produces 70 cards', () => {
    expect(buildDeck()).toHaveLength(70)
  })
})

describe('playCard', () => {
  it('removes card from player hand', () => {
    // ...
  })
  it('triggers round end when 5th painting of same artist is played', () => {
    // ...
  })
})
```

**Test placement convention to use:**
- Co-locate test files with source: `src/lib/engine.test.ts` next to `src/lib/engine.ts`
- Name test files `*.test.ts` or `*.test.tsx`

## Priority Areas for Test Coverage

Listed by risk/complexity of untested logic:

1. **`src/lib/engine.ts`** — auction resolution logic (`resolveAuction`, `submitSealedBid`, `placeOnceAroundBid`, `endRound`). Contains financial calculations and turn-order logic with many edge cases.
2. **`src/lib/engine.ts`** — round-end scoring and cumulative value carry-over in `endRound`.
3. **`src/lib/deck.ts`** — `dealHands` distribution per player count and round.
4. **`src/lib/engine.ts`** — double auction resolution (second card mechanic in `playSecondCard`).

---

*Testing analysis: 2026-04-06*

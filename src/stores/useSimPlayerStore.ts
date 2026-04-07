// ─── Sim Player Store (persisted) ───────────────────────────────────────────
//
// localStorage-persisted per-room per-player UI preferences. Scoped via the
// factory createSimPlayerStore({ roomCode, sessionId }) so two rooms in the
// same browser do not collide. Contains ONLY ephemeral preferences — never
// authoritative game state.

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Neighborhood } from '../types/game'

export interface SimPlayerState {
  lastViewedDay: number
  preferredNeighborhood: Neighborhood | null
  tutorialDismissed: boolean
  setLastViewedDay: (d: number) => void
  setPreferredNeighborhood: (n: Neighborhood | null) => void
  dismissTutorial: () => void
}

export interface SimPlayerStoreScope {
  roomCode: string
  sessionId: string
}

export function createSimPlayerStore(scope: SimPlayerStoreScope) {
  const name = `sim-player:${scope.roomCode}:${scope.sessionId}`
  return create<SimPlayerState>()(
    persist(
      (set) => ({
        lastViewedDay: 0,
        preferredNeighborhood: null,
        tutorialDismissed: false,
        setLastViewedDay: (d) => set({ lastViewedDay: d }),
        setPreferredNeighborhood: (n) => set({ preferredNeighborhood: n }),
        dismissTutorial: () => set({ tutorialDismissed: true }),
      }),
      {
        name,
        storage: createJSONStorage(() => localStorage),
      },
    ),
  )
}

// Default singleton-style store for components that do not yet have a scope.
// Real per-room scoping happens inside useSim, which calls createSimPlayerStore
// on mount once roomCode + sessionId are known.
export const useSimPlayerStore = createSimPlayerStore({
  roomCode: 'default',
  sessionId: 'anon',
})

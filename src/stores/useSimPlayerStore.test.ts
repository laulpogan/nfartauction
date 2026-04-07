import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSimPlayerStore } from './useSimPlayerStore'

// Vitest 4 jsdom localStorage is flaky under the experimental --localstorage-file
// flag, so we install a deterministic in-memory shim for the duration of this
// suite. Persist middleware only needs getItem/setItem/removeItem.
function makeMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)) },
    removeItem: (k: string) => { map.delete(k) },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
  }
}

describe('useSimPlayerStore', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeMemoryStorage())
  })

  it('defaults to lastViewedDay=0, preferredNeighborhood=null, tutorialDismissed=false', () => {
    const useStore = createSimPlayerStore({ roomCode: 'r', sessionId: 's' })
    const s = useStore.getState()
    expect(s.lastViewedDay).toBe(0)
    expect(s.preferredNeighborhood).toBeNull()
    expect(s.tutorialDismissed).toBe(false)
  })

  it('setLastViewedDay updates state', () => {
    const useStore = createSimPlayerStore({ roomCode: 'r', sessionId: 's' })
    useStore.getState().setLastViewedDay(3)
    expect(useStore.getState().lastViewedDay).toBe(3)
  })

  it('setPreferredNeighborhood updates state', () => {
    const useStore = createSimPlayerStore({ roomCode: 'r', sessionId: 's' })
    useStore.getState().setPreferredNeighborhood('warehouse')
    expect(useStore.getState().preferredNeighborhood).toBe('warehouse')
  })

  it('dismissTutorial flips tutorialDismissed to true', () => {
    const useStore = createSimPlayerStore({ roomCode: 'r', sessionId: 's' })
    useStore.getState().dismissTutorial()
    expect(useStore.getState().tutorialDismissed).toBe(true)
  })

  it('different scopes write to different localStorage keys', () => {
    const a = createSimPlayerStore({ roomCode: 'room-A', sessionId: 'sess-1' })
    const b = createSimPlayerStore({ roomCode: 'room-B', sessionId: 'sess-1' })
    a.getState().setLastViewedDay(5)
    b.getState().setLastViewedDay(9)
    // Both stores rehydrated from different keys, so they should not collide.
    expect(a.getState().lastViewedDay).toBe(5)
    expect(b.getState().lastViewedDay).toBe(9)
    // And the keys should exist in localStorage under the scoped names.
    expect(localStorage.getItem('sim-player:room-A:sess-1')).not.toBeNull()
    expect(localStorage.getItem('sim-player:room-B:sess-1')).not.toBeNull()
  })

  it('same scope sees persisted updates across store instances', () => {
    const a = createSimPlayerStore({ roomCode: 'shared', sessionId: 'x' })
    a.getState().setLastViewedDay(7)
    a.getState().dismissTutorial()
    // New store instance with same scope — should rehydrate from storage.
    const b = createSimPlayerStore({ roomCode: 'shared', sessionId: 'x' })
    expect(b.getState().lastViewedDay).toBe(7)
    expect(b.getState().tutorialDismissed).toBe(true)
  })
})

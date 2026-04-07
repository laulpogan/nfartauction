// ─── Sim Session Store (ephemeral) ──────────────────────────────────────────
//
// Holds draft TimeSlot staging and submission flag for the current sim_day.
// NO persist middleware — this is wiped on reload, which is intentional:
// the server is the source of truth for any slots that have actually been
// submitted; anything in the draft is pre-submission UI state only.

import { create } from 'zustand'
import type { TimeSlot } from '../types/game'

export interface SimSessionState {
  draftSlots: TimeSlot[]
  isSubmitting: boolean
  addDraftSlot: (slot: TimeSlot) => void
  removeDraftSlot: (id: string) => void
  clearDraft: () => void
  setSubmitting: (v: boolean) => void
}

export const useSimSessionStore = create<SimSessionState>((set) => ({
  draftSlots: [],
  isSubmitting: false,
  addDraftSlot: (slot) =>
    set((s) => ({ draftSlots: [...s.draftSlots, slot] })),
  removeDraftSlot: (id) =>
    set((s) => ({ draftSlots: s.draftSlots.filter((x) => x.id !== id) })),
  clearDraft: () => set({ draftSlots: [], isSubmitting: false }),
  setSubmitting: (v) => set({ isSubmitting: v }),
}))

// ─── useSim — client reactive composition hook ──────────────────────────────
//
// Composes useGame's authoritative slices (sim, playerSim) with the ephemeral
// Zustand draft store. The server is the source of truth for everything that
// matters; this hook only orchestrates draft staging and submission UX.
//
// Usage:
//   const game = useGame(room, name)
//   const sim = useSim({
//     game: game.game,
//     playerSim: game.playerSim,
//     sessionId: game.sessionId,
//     submitSlots: game.actions.submitSlots,
//   })
//
// useSim deliberately does NOT hold authoritative server state in zustand —
// sim/playerSim pass through from useGame's useState. Zustand here is DRAFT
// (ephemeral) + PERSISTED preferences only.

import { useEffect, useMemo } from 'react'
import type { GameState, PlayerSimState, TimeSlot } from '../types/game'
import { useSimSessionStore } from '../stores/useSimSessionStore'
import { SIM_CONFIG } from '../lib/sim-config'

export interface UseSimArgs {
  game: GameState | null
  playerSim: PlayerSimState | null
  sessionId: string
  submitSlots: (slots: TimeSlot[]) => void
}

export function useSim(args: UseSimArgs) {
  const draftSlots = useSimSessionStore((s) => s.draftSlots)
  const isSubmitting = useSimSessionStore((s) => s.isSubmitting)
  const addDraftSlot = useSimSessionStore((s) => s.addDraftSlot)
  const removeDraftSlot = useSimSessionStore((s) => s.removeDraftSlot)
  const clearDraft = useSimSessionStore((s) => s.clearDraft)
  const setSubmitting = useSimSessionStore((s) => s.setSubmitting)

  const sim = args.game?.sim ?? null
  const phase = args.game?.phase ?? null
  const slotsRemaining = SIM_CONFIG.SLOTS_PER_DAY - draftSlots.length

  // Server-confirmed-submission auto-clear: when we are in the isSubmitting
  // state AND the server's next playerSim snapshot shows scheduledSlots==[]
  // (which is what advanceFromSimDay leaves behind after executing the plan),
  // clear the draft. The empty-initial-state case is filtered out by the
  // isSubmitting guard — we only trust this signal AFTER we sent a submission.
  useEffect(() => {
    if (!isSubmitting) return
    if (args.playerSim && args.playerSim.scheduledSlots.length === 0) {
      clearDraft()
    }
  }, [args.playerSim, isSubmitting, clearDraft])

  const submitDraft = () => {
    if (draftSlots.length === 0) return
    if (isSubmitting) return
    setSubmitting(true)
    args.submitSlots(draftSlots)
  }

  const hasSubmitted = useMemo(() => {
    if (!phase || phase.type !== 'sim_day') return false
    return phase.submittedSessionIds.includes(args.sessionId)
  }, [phase, args.sessionId])

  return {
    sim,
    phase,
    playerSim: args.playerSim,
    draftSlots,
    draftSlotCount: draftSlots.length,
    slotsRemaining,
    hasSubmitted,
    isSubmitting,
    actions: {
      addDraftSlot,
      removeDraftSlot,
      clearDraft,
      submitDraft,
    },
  }
}

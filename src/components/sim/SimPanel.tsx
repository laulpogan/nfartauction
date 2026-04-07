import { useState, useEffect } from 'react'
import {
  NeighborhoodProvider,
  type Neighborhood,
} from '../../contexts/NeighborhoodContext'
import { WallLabel } from '../aesthetic/WallLabel'
import { useSim } from '../../hooks/useSim'
import type { GameState, PlayerSimState, TimeSlot } from '../../types/game'
import { StatDisplay } from './StatDisplay'
import { GlobalStatsBar } from './GlobalStatsBar'
import { NeighborhoodMap } from './NeighborhoodMap'
import { SlotPicker } from './SlotPicker'
import { DayResultReceipt } from './DayResultReceipt'
import { RelationshipPanel } from './RelationshipPanel'
import { LandlordMessages } from './LandlordMessages'

export interface SimPanelProps {
  game: GameState | null
  playerSim: PlayerSimState | null
  sessionId: string
  submitSlots: (slots: TimeSlot[]) => void
}

export function SimPanel({
  game,
  playerSim,
  sessionId,
  submitSlots,
}: SimPanelProps) {
  const {
    sim,
    phase,
    draftSlots,
    slotsRemaining,
    hasSubmitted,
    isSubmitting,
    actions,
  } = useSim({ game, playerSim, sessionId, submitSlots })

  const me = game?.players.find((p) => p.sessionId === sessionId) ?? null
  const currentNeighborhood: Neighborhood =
    playerSim?.currentNeighborhood ?? 'gallery'
  const [selectedNeighborhood, setSelectedNeighborhood] =
    useState<Neighborhood>(currentNeighborhood)

  // Keep selection in sync if the player's authoritative location changes.
  useEffect(() => {
    setSelectedNeighborhood(currentNeighborhood)
  }, [currentNeighborhood])

  if (!sim || !phase || phase.type !== 'sim_day' || !me) return null

  return (
    <NeighborhoodProvider neighborhood={selectedNeighborhood}>
      <main className="min-h-screen bg-paper text-ink p-4 max-w-2xl mx-auto space-y-6">
        <header className="text-center space-y-1">
          <div>
            <WallLabel size="lg">DAY {sim.dayNumber}</WallLabel>
          </div>
          <div>
            <WallLabel size="sm">
              {hasSubmitted
                ? 'SUBMITTED — WAITING FOR OTHERS'
                : `${slotsRemaining} SLOTS REMAINING`}
            </WallLabel>
          </div>
        </header>

        <GlobalStatsBar sim={sim} />
        <StatDisplay player={me} playerSim={playerSim} />
        <RelationshipPanel
          playerSim={playerSim}
          roundValues={game?.roundValues ?? null}
        />
        <LandlordMessages playerSim={playerSim} />
        <NeighborhoodMap
          selected={selectedNeighborhood}
          onSelect={setSelectedNeighborhood}
        />

        {hasSubmitted ? (
          <DayResultReceipt events={null} />
        ) : (
          <>
            <SlotPicker
              slotsRemaining={slotsRemaining}
              currentNeighborhood={selectedNeighborhood}
              draftSlots={draftSlots}
              onAddSlot={actions.addDraftSlot}
              onRemoveSlot={actions.removeDraftSlot}
            />
            <button
              type="button"
              disabled={draftSlots.length === 0 || isSubmitting}
              onClick={actions.submitDraft}
              className="w-full border-2 border-ink py-3 uppercase tracking-[0.18em] font-bold disabled:opacity-30 hover:bg-[var(--color-accent)]/10"
            >
              SUBMIT DAY
            </button>
          </>
        )}
      </main>
    </NeighborhoodProvider>
  )
}

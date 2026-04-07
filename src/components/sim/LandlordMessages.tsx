import { clsx } from 'clsx'
import { WallLabel } from '../aesthetic/WallLabel'
import { LANDLORD_MESSAGES } from '../../lib/sim-engine'
import type { PlayerSimState, LandlordStage } from '../../types/game'

export interface LandlordMessagesProps {
  playerSim: PlayerSimState | null
}

/**
 * iMessage-style chronological bubble list for the landlord arc.
 *
 * Renders one bordered bubble per stage in `seenLandlordStages`, each
 * containing the authored text from `LANDLORD_MESSAGES`. Typography stays
 * in WallLabel register (uppercase small-caps tracking) so it reads as a
 * gallery wall label, not a UI chat component. The most recent bubble
 * (last index) gets an accent border so it reads as "newest".
 *
 * Privacy: receives only the owning connection's playerSim (the same
 * private channel pattern as RelationshipPanel). Opponents never see this.
 */
export function LandlordMessages({ playerSim }: LandlordMessagesProps) {
  if (!playerSim) return null
  const seen = playerSim.seenLandlordStages
  if (!seen || seen.length === 0) return null

  return (
    <section
      data-landlord-messages
      className="space-y-3 border-t border-ink pt-4"
    >
      <WallLabel size="sm">FROM: BUILDING MGMT</WallLabel>
      <ol className="space-y-2 list-none p-0">
        {seen.map((stage: LandlordStage, idx: number) => {
          const isLast = idx === seen.length - 1
          return (
            <li
              key={`${stage}-${idx}`}
              data-stage={stage}
              className={clsx(
                'border-2 rounded-2xl px-4 py-2 max-w-[75%] bg-paper',
                isLast
                  ? 'border-[var(--color-accent)] accent-border'
                  : 'border-ink',
              )}
            >
              <WallLabel size="sm">{LANDLORD_MESSAGES[stage]}</WallLabel>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

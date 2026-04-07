import type { GameState, FinalAppraisal, Faction } from '../../types/game'
import { Receipt, ReceiptRow } from '../aesthetic/Receipt'
import { WallLabel } from '../aesthetic/WallLabel'
import { Button } from '../ui/Button'
import { APPRAISAL_HEADER } from '../../lib/sim-config'

export interface EndStateAppraisalProps {
  game: GameState
  appraisals: Record<string, FinalAppraisal> | null
  myPlayerIdx: number
  onPlayAgain: () => void
}

const FACTION_LABEL: Record<Faction, string> = {
  painters: 'PAINTERS',
  sculptors: 'SCULPTORS',
  video_art: 'VIDEO ART',
  social_political: 'SOCIAL / POLITICAL',
}

function nftBucketLabel(heldCount: number): string {
  if (heldCount === 0) return 'NO CHAIN'
  if (heldCount <= 2) return 'NFT EXPOSURE: CASUAL'
  return 'NFT EXPOSURE: DEEP'
}

function flatlandsLabel(count: number): string {
  if (count === 0) return 'NEVER FLATLANDS'
  if (count <= 2) return 'FLATLANDS (OCCASIONAL)'
  return 'FLATLANDS NATIVE'
}

function factionSummary(a: FinalAppraisal): string {
  const faction = a.dominantFaction ? FACTION_LABEL[a.dominantFaction] : 'UNDECLARED'
  return `${faction} / ${nftBucketLabel(a.nftExposure.heldCount)} / ${flatlandsLabel(a.roundsInFlatlands)}`
}

/**
 * EndStateAppraisal — the printed-appraisal end-state document.
 *
 * Renders only when game.status === 'game_over'. Wraps a printed receipt
 * containing (in order): a WINNER WallLabel, a money-desc leaderboard of
 * ReceiptRows (END-03), a per-player appraisal section with faction
 * summary + three-sentence epitaph + key-contact rows, and a BACK TO LOBBY
 * button. Falls back to leaderboard-only if `appraisals` is null so the
 * component still works when the broadcast is missed.
 */
export function EndStateAppraisal({
  game,
  appraisals,
  myPlayerIdx,
  onPlayAgain,
}: EndStateAppraisalProps) {
  if (game.status !== 'game_over') return null

  const sorted = [...game.players]
    .map((p, idx) => ({ ...p, originalIdx: idx }))
    .sort((a, b) => b.money - a.money)
  const winner = sorted[0]
  const myPlayer = game.players[myPlayerIdx]
  const galleryName = (myPlayer?.displayName ?? 'the gallery').toUpperCase()
  const subheader = APPRAISAL_HEADER.replace('{gallery}', galleryName)

  return (
    <Receipt header="PRINTED APPRAISAL" subheader={subheader} stamped>
      {/* WINNER */}
      <div className="text-center">
        <WallLabel size="lg">
          {(winner?.displayName ?? '').toUpperCase()}
        </WallLabel>
      </div>
      <div
        data-testid="winner-subheader"
        className="text-center text-xs uppercase tracking-[0.15em] text-ink-soft mb-4"
      >
        DECLARED THE WINNER
      </div>

      <div className="dotted-rule my-3" />

      {/* LEADERBOARD */}
      <div className="space-y-1" data-testid="leaderboard">
        {sorted.map((player, rank) => (
          <ReceiptRow
            key={player.id}
            label={`${rank + 1}. ${player.displayName.toUpperCase()}${player.originalIdx === myPlayerIdx ? ' (YOU)' : ''}`}
            value={`$${player.money.toLocaleString()}`}
          />
        ))}
      </div>

      {/* APPRAISAL SECTIONS */}
      {appraisals && (
        <div className="mt-6 space-y-4" data-testid="appraisal-sections">
          {sorted.map(player => {
            const a = appraisals[player.sessionId]
            if (!a) return null
            return (
              <div
                key={player.id}
                data-testid={`appraisal-${player.sessionId}`}
                className="border-t border-rule pt-3"
              >
                <div className="mb-2">
                  <WallLabel
                    artist={a.displayName.toUpperCase()}
                    medium={factionSummary(a)}
                  />
                </div>
                <p
                  data-testid={`epitaph-${player.sessionId}`}
                  className="font-receipt text-sm text-ink leading-relaxed"
                >
                  {a.threeSentenceEpitaph}
                </p>
                {a.keyRelationships.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {a.keyRelationships.map(rel => (
                      <ReceiptRow
                        key={rel.displayName}
                        label="KEY CONTACT"
                        value={`${rel.displayName}: ${rel.status}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-4">
        <Button variant="gold" className="w-full" onClick={onPlayAgain}>
          BACK TO LOBBY
        </Button>
      </div>
    </Receipt>
  )
}

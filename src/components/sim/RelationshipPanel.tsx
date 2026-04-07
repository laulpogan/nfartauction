import { AppraisalForm, type AppraisalRow } from '../aesthetic/AppraisalForm'
import { WallLabel } from '../aesthetic/WallLabel'
import {
  deriveFactionAlignment,
  deriveCredibilityPenalty,
} from '../../lib/sim-engine'
import { RELATIONSHIP_CONFIG } from '../../lib/sim-config'
import type { PlayerSimState, Artist, Faction } from '../../types/game'

export interface RelationshipPanelProps {
  playerSim: PlayerSimState | null
  roundValues: Record<Artist, number> | null
}

const FACTION_LABELS: Record<Faction, string> = {
  painters: 'PAINTERS',
  sculptors: 'SCULPTORS',
  video_art: 'VIDEO',
  social_political: 'SOCIAL/POL',
}

/**
 * Chip primitive used for COLD / DROPPED state. Plain bordered span in
 * WallLabel typography — no emoji, no color, zine register.
 */
function Chip({
  label,
  dataAttr,
}: {
  label: string
  dataAttr: 'data-cold' | 'data-dropped'
}) {
  const attrs = { [dataAttr]: '' } as Record<string, string>
  return (
    <span
      {...attrs}
      className="inline-block border border-ink px-1.5 py-[1px] ml-2 align-middle"
    >
      <WallLabel size="sm">{label}</WallLabel>
    </span>
  )
}

export function RelationshipPanel({
  playerSim,
  roundValues,
}: RelationshipPanelProps) {
  if (!playerSim) return null

  const relationships = playerSim.relationships
  const coldThreshold = RELATIONSHIP_CONFIG.coldThreshold

  const rows: AppraisalRow[] = relationships.map((r) => {
    const isCold = !r.isDroppedArtist && r.score < coldThreshold
    const chips = (
      <>
        {isCold && <Chip label="COLD" dataAttr="data-cold" />}
        {r.isDroppedArtist && <Chip label="DROPPED" dataAttr="data-dropped" />}
      </>
    )
    return {
      label: r.displayName.toUpperCase(),
      value: (
        <span data-relationship-id={r.characterId}>
          <span>{Math.round(r.score)}</span>
          {chips}
        </span>
      ),
    }
  })

  // Faction alignment summary (derived, never stored).
  const factions = deriveFactionAlignment(relationships)
  const factionSummary = (Object.keys(factions) as Faction[])
    .map((f) => `${FACTION_LABELS[f]} ${Math.round(factions[f])}`)
    .join(' / ')
  rows.push({
    label: 'FACTION',
    value: <span data-faction-summary>{factionSummary}</span>,
  })

  // Credibility penalty row — only rendered when a dropped artist is set
  // and the penalty is non-zero.
  if (roundValues) {
    const cred = deriveCredibilityPenalty(relationships, roundValues)
    if (cred.penalty !== 0) {
      rows.push({
        label: 'CREDIBILITY',
        value: (
          <span data-credibility-penalty={cred.penalty}>
            {cred.penalty}
          </span>
        ),
        emphasis: true,
      })
    }
  }

  return (
    <AppraisalForm title="CONTACTS" formNumber="FORM C-22" rows={rows} />
  )
}

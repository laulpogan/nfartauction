import { AppraisalForm, type AppraisalRow } from '../aesthetic/AppraisalForm'
import type { PublicPlayer, PlayerSimState } from '../../types/game'

// Money is the same field used by GameBoard (game.players[idx].money). Single
// source of truth per SIM-07 — there is no separate sim wallet.
const formatMoney = (n: number) => `$${n.toLocaleString('en-US')}`

export interface StatDisplayProps {
  player: PublicPlayer
  playerSim: PlayerSimState | null
}

export function StatDisplay({ player, playerSim }: StatDisplayProps) {
  const rows: AppraisalRow[] = [
    { label: 'MONEY', value: formatMoney(player.money), emphasis: true },
  ]
  if (playerSim) {
    rows.push(
      { label: 'COOLNESS', value: String(playerSim.coolness) },
      { label: 'RESTEDNESS', value: String(playerSim.restedness) },
      { label: 'LUCK', value: String(playerSim.luck) },
    )
    // Phase 4 Plan 03: RISK stat surfaces only once it's been accumulated
    // (drugs carried above DRUG_CONFIG.riskThreshold). Hidden at 0 so the
    // form stays quiet until the player has actually acquired risk.
    if (playerSim.risk > 0) {
      rows.push({ label: 'RISK', value: String(playerSim.risk) })
    }
  }
  return (
    <AppraisalForm title="GALLERY APPRAISAL" formNumber="FORM A-14" rows={rows} />
  )
}

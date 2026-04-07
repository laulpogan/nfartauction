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
  }
  return (
    <AppraisalForm title="GALLERY APPRAISAL" formNumber="FORM A-14" rows={rows} />
  )
}

import { AppraisalForm, type AppraisalRow } from '../aesthetic/AppraisalForm'
import type { SimState } from '../../types/game'

export interface GlobalStatsBarProps {
  sim: SimState
}

export function GlobalStatsBar({ sim }: GlobalStatsBarProps) {
  const rows: AppraisalRow[] = [
    { label: 'HOTNESS', value: `${Math.round(sim.artMarketHotness * 100)}%` },
    { label: 'GENTRIFICATION', value: `${sim.gentrificationLevel} / 10` },
    { label: 'NFT HYPE', value: `${sim.nftHypeCycle} / 100` },
    { label: 'DAY', value: String(sim.dayNumber) },
  ]
  return <AppraisalForm title="ART MARKET" formNumber="FORM M-02" rows={rows} />
}

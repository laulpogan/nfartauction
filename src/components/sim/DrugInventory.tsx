import { AppraisalForm, type AppraisalRow } from '../aesthetic/AppraisalForm'
import type { PlayerSimState } from '../../types/game'

export interface DrugInventoryProps {
  playerSim: PlayerSimState | null
}

/**
 * Drug inventory, rendered as an AppraisalForm in the same wall-label format
 * as the painting collection. The "Untitled (White), mixed media, 2024" = 1g
 * coke bit is the whole joke — the gallery-bio display strings live in
 * DRUG_DEFINITIONS (sim-config) and the engine's addDrugItem bakes them
 * into the DrugItem on acquisition.
 *
 * Empty state: a single non-identified "no acquisitions" row.
 * Populated:  one AppraisalRow per item, each wrapped in a <div> carrying
 *             data-drug-id so RTL tests and e2e can target individual items.
 *
 * Privacy: receives only the owning connection's playerSim — opponents never
 * see this (same private channel pattern as RelationshipPanel / LandlordMessages).
 */
export function DrugInventory({ playerSim }: DrugInventoryProps) {
  if (!playerSim) return null

  const rows: AppraisalRow[] =
    playerSim.drugs.length === 0
      ? [{ label: '—', value: 'no acquisitions' }]
      : playerSim.drugs.map(d => ({
          label: d.displayLabel,
          // Wrap the meta value in a data-drug-id span so the row is
          // addressable from tests without needing a custom AppraisalRow
          // extension. AppraisalForm renders row.value inside the <dd>.
          value: <span data-drug-id={d.id}>{d.displayMeta}</span>,
        }))

  return (
    <AppraisalForm title="INVENTORY" formNumber="FORM I-08" rows={rows} />
  )
}

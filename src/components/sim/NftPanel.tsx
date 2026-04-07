import { OnlineNeighborhood } from '../aesthetic/OnlineNeighborhood'
import { AppraisalForm, type AppraisalRow } from '../aesthetic/AppraisalForm'
import { Button } from '../ui/Button'
import { computeNftExchangeRate } from '../../lib/sim-engine'
import { NFT_CONFIG } from '../../lib/sim-config'
import type { PlayerSimState } from '../../types/game'

export interface NftPanelProps {
  playerSim: PlayerSimState | null
  nftHypeCycle: number
  onConvert: (amount: number) => void
  onPurchase: () => void
}

/**
 * NftPanel — the NFT parallel economy surface. Wrapped in OnlineNeighborhood
 * (Phase 2 component) so the broken-font / accent-flicker aesthetic activates
 * for this subtree only — the rest of SimPanel keeps its straight gallery
 * register, the panel reads as the chain colonizing the gallery.
 *
 * Conditional render gate: returns null when playerSim is null OR when
 * !playerSim.nftWalletUnlocked. The unlock bit is set ONLY by the server's
 * threshold-cross detector inside advanceFromSimDay (T-5-05), so this gate
 * is the client mirror of the same invariant.
 *
 * Privacy: receives only the owning connection's playerSim — opponents never
 * see any of these fields (same private channel pattern as DrugInventory).
 */
export function NftPanel({
  playerSim,
  nftHypeCycle,
  onConvert,
  onPurchase,
}: NftPanelProps) {
  if (!playerSim) return null
  if (!playerSim.nftWalletUnlocked) return null

  const rate = computeNftExchangeRate(nftHypeCycle)

  const headerRows: AppraisalRow[] = [
    { label: 'WALLET', value: String(playerSim.nftWallet), emphasis: true },
    { label: 'RATE', value: rate.toFixed(2) },
    { label: 'HYPE', value: String(Math.round(nftHypeCycle)) },
  ]

  const holdingRows: AppraisalRow[] =
    playerSim.heldNfts.length === 0
      ? [{ label: '—', value: 'no holdings' }]
      : playerSim.heldNfts.map(item => ({
          label: item.displayLabel,
          value: <span data-nft-id={item.id}>{item.displayMeta}</span>,
        }))

  const rows: AppraisalRow[] = [...headerRows, ...holdingRows]

  const convertDisabled = playerSim.nftWallet === 0
  const purchaseDisabled = playerSim.nftWallet < NFT_CONFIG.whitelistCost

  return (
    <OnlineNeighborhood>
      <section data-nft-panel className="space-y-3">
        <AppraisalForm title="NFT WALLET" formNumber="FORM N-13" rows={rows} />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={convertDisabled}
            onClick={() => onConvert(playerSim.nftWallet)}
          >
            CONVERT
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={purchaseDisabled}
            onClick={onPurchase}
          >
            WHITELIST PURCHASE
          </Button>
        </div>
      </section>
    </OnlineNeighborhood>
  )
}

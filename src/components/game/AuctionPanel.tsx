import { AnimatePresence } from 'framer-motion'
import type { AuctionSkinProps } from './auction-skins/types'
import { OpenAuctionSkin } from './auction-skins/OpenAuctionSkin'
import { OnceAroundSkin } from './auction-skins/OnceAroundSkin'
import { SealedBidSkin } from './auction-skins/SealedBidSkin'
import { FixedPriceSkin } from './auction-skins/FixedPriceSkin'
import { DoubleSkin } from './auction-skins/DoubleSkin'

export type AuctionPanelProps = AuctionSkinProps

/**
 * Slim dispatcher. The visual logic for each auction type lives in its own
 * skin sub-component under ./auction-skins. AuctionPanel only decides which
 * skin to mount, wrapped in AnimatePresence mode="wait" keyed on
 * auction.id so skin swaps between distinct auctions never visually
 * overlap.
 */
export function AuctionPanel(props: AuctionPanelProps) {
  const { game } = props
  if (!game.auction) return null

  const skin = (() => {
    switch (game.auction.auctionType) {
      case 'open':
        return <OpenAuctionSkin {...props} />
      case 'once_around':
        return <OnceAroundSkin {...props} />
      case 'sealed_bid':
        return <SealedBidSkin {...props} />
      case 'fixed_price':
        return <FixedPriceSkin {...props} />
      case 'double':
        return <DoubleSkin {...props} />
    }
  })()

  return (
    <AnimatePresence mode="wait">
      <div key={game.auction.id}>{skin}</div>
    </AnimatePresence>
  )
}

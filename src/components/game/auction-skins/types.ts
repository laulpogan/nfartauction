import type { GameState } from '../../../types/game'

/**
 * Shared prop contract for every auction skin sub-component.
 *
 * The AuctionPanel dispatcher forwards these props unchanged to whichever
 * skin matches `game.auction.auctionType`. This interface MUST remain
 * assignment-compatible with the existing GameBoard → AuctionPanel call site
 * so no GameBoard edit is required when routing through the dispatcher.
 */
export interface AuctionSkinProps {
  game: GameState
  myPlayerIdx: number
  isAuctioneer: boolean
  myMoney: number
  onSetFixedPrice: (price: number) => void
  onAcceptFixedPrice: () => void
  onPassFixedPrice: () => void
  onPlaceOpenBid: (amount: number) => void
  onEndOpenAuction: () => void
  onPlaceOnceAroundBid: (amount: number | null) => void
  onSubmitSealedBid: (amount: number) => void
}

export function formatMoney(n: number): string {
  return `$${n.toLocaleString()}`
}

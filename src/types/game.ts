export type Artist = 'lite_metal' | 'yoko' | 'christine_p' | 'karl_gitter' | 'krypto'

export type AuctionType = 'open' | 'once_around' | 'sealed_bid' | 'fixed_price' | 'double'

export type GameStatus = 'lobby' | 'playing' | 'round_end' | 'game_over'

export type AuctionStatus =
  | 'waiting_second'   // double auction waiting for partner card
  | 'set_price'        // fixed_price: auctioneer setting price
  | 'active'           // bidding in progress
  | 'completed'

export interface Card {
  id: string
  artist: Artist
  auctionType: AuctionType
}

export interface PublicPlayer {
  id: string
  sessionId: string
  displayName: string
  position: number
  money: number
  paintingCount: number
  paintings: { artist: Artist; round: number }[]
  isHost: boolean
}

export interface AuctionState {
  id: string
  auctioneerIdx: number
  cards: Card[]
  auctionType: AuctionType   // resolved type (from second card if double)
  status: AuctionStatus
  fixedPrice: number | null
  currentBid: number
  leadingBidderIdx: number | null
  sealedBids: Record<number, number>   // playerIdx -> bid
  onceAroundBids: Record<number, number | null>  // playerIdx -> bid or null=pass
  onceAroundCurrentIdx: number
  winnerIdx: number | null
  finalPrice: number | null
}

export interface RoundResult {
  round: number
  artistCounts: Record<Artist, number>
  rankings: { artist: Artist; count: number; value: number; cumulativeValue: number }[]
  payouts: { playerIdx: number; amount: number; breakdown: { artist: Artist; count: number; value: number }[] }[]
}

export interface GameState {
  id: string
  code: string
  status: GameStatus
  round: 1 | 2 | 3 | 4
  currentPlayerIdx: number
  artistCounts: Record<Artist, number>
  roundValues: Record<Artist, number>  // cumulative (carry over across rounds)
  roundHistory: RoundResult[]
  deck: Card[]                         // server keeps deck here
  auction: AuctionState | null
  players: PublicPlayer[]
}

export interface PlayerRecord {
  id: string
  gameId: string
  sessionId: string
  displayName: string
  position: number
  money: number
  hand: Card[]
  paintings: { artist: Artist; round: number }[]
  isHost: boolean
}

export const ARTISTS: Artist[] = ['lite_metal', 'yoko', 'christine_p', 'karl_gitter', 'krypto']

export const ARTIST_NAMES: Record<Artist, string> = {
  lite_metal: 'Lite Metal',
  yoko: 'Yoko',
  christine_p: 'Christine P.',
  karl_gitter: 'Karl Gitter',
  krypto: 'Krypto',
}

export const ARTIST_COLORS: Record<Artist, { bg: string; border: string; text: string; accent: string; card: string }> = {
  lite_metal:   { bg: 'bg-violet-950', border: 'border-violet-400', text: 'text-violet-300', accent: 'bg-violet-500', card: 'from-violet-900 to-violet-800' },
  yoko:         { bg: 'bg-cyan-950',   border: 'border-cyan-400',   text: 'text-cyan-300',   accent: 'bg-cyan-500',   card: 'from-cyan-900 to-cyan-800' },
  christine_p:  { bg: 'bg-rose-950',   border: 'border-rose-400',   text: 'text-rose-300',   accent: 'bg-rose-500',   card: 'from-rose-900 to-rose-800' },
  karl_gitter:  { bg: 'bg-amber-950',  border: 'border-amber-400',  text: 'text-amber-300',  accent: 'bg-amber-500',  card: 'from-amber-900 to-amber-800' },
  krypto:       { bg: 'bg-emerald-950',border: 'border-emerald-400',text: 'text-emerald-300',accent: 'bg-emerald-500',card: 'from-emerald-900 to-emerald-800' },
}

export const AUCTION_TYPE_NAMES: Record<AuctionType, string> = {
  open: 'Open',
  once_around: 'Once Around',
  sealed_bid: 'Sealed Bid',
  fixed_price: 'Fixed Price',
  double: 'Double',
}

export const AUCTION_TYPE_ICONS: Record<AuctionType, string> = {
  open: '🔨',
  once_around: '🔄',
  sealed_bid: '🤫',
  fixed_price: '🏷️',
  double: '✌️',
}

export const ROUND_VALUES = [30000, 20000, 10000]  // 1st, 2nd, 3rd place

export const HAND_DISTRIBUTION: Record<number, { initial: number; extra: number[] }> = {
  2: { initial: 10, extra: [6, 6, 0] },  // rounds 2,3,4
  3: { initial: 10, extra: [6, 6, 0] },
  4: { initial: 9,  extra: [4, 4, 0] },
  5: { initial: 8,  extra: [3, 3, 0] },
}

export const ROUND_END_THRESHOLD = 5  // 5th painting of any artist ends the round

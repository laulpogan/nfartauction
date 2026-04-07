// Re-export Neighborhood so sim consumers can pull it from a single types module.
export type { Neighborhood } from '../contexts/NeighborhoodContext'
import type { Neighborhood } from '../contexts/NeighborhoodContext'

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
  // Sim public mirror fields — opponents are allowed to see these.
  // Private sim state lives in the per-connection PlayerSimState channel.
  coolness: number
  prestige: number
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
  waitingSecondCardIdx: number   // whose turn it is to play/pass the 2nd card during 'waiting_second'
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
  // Phase 3 sim-loop additions. The phase discriminated union drives the
  // alternating sim_day ↔ auction_round flow; SimState is the public global
  // sim snapshot. Per-player private sim state lives server-side and is sent
  // to its owning connection via YOUR_SIM_STATE.
  phase: GamePhase
  sim: SimState
}

// Public projection types — what clients are allowed to see.
// Sealed bid AMOUNTS are stripped (presence-only) until the auction completes,
// and the deck is never broadcast.
export type PublicAuctionState = Omit<AuctionState, 'sealedBids'> & {
  sealedBids: Record<number, true>
}

export type PublicGameState = Omit<GameState, 'deck' | 'auction'> & {
  deck: never[]
  auction: PublicAuctionState | null
}

export interface PlayerRecord {
  id: string
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

// ─── Phase 3: Sim Loop Types ────────────────────────────────────────────────
//
// These types define the contract for the gallery sim layer. The phase
// discriminated union drives the alternating sim_day ↔ auction_round loop.
// PlayerSimState is private (server → owning connection only); SimState is
// public and broadcast in GameState.

export type GamePhase =
  | { type: 'lobby' }
  | { type: 'sim_day'; dayNumber: number; submittedSessionIds: string[] }
  | { type: 'auction_round'; roundNumber: number }
  | { type: 'game_over' }

export type SlotType =
  | 'gallery_work'
  | 'studio_visits'
  | 'art_fair'
  | 'opening'
  | 'party'
  | 'sleep'

export interface TimeSlot {
  id: string
  type: SlotType
  neighborhood: Neighborhood | null
  /**
   * Optional character id for relationship-affecting slots.
   * Only honored by studio_visits / opening / art_fair resolution paths;
   * other slot types ignore this field. The engine's updateRelationship
   * silently no-ops on unknown ids (defense in depth for T-4-01).
   */
  targetCharacterId?: string
}

// ─── Phase 4: Relationship system ──────────────────────────────────────────

export type Faction = 'painters' | 'sculptors' | 'video_art' | 'social_political'
export type RelationshipCharacterKind = 'artist' | 'collector'

export interface Relationship {
  /** Stable id, e.g. 'artist:lite_metal' or 'collector:helena_v' */
  characterId: string
  kind: RelationshipCharacterKind
  displayName: string
  bio: string
  factionAlignment: Faction
  /** Score range [-50, 100]. Negative reserved for the dropped-artist seed. */
  score: number
  /** Sim days since last positive contact. Resets on updateRelationship(+). */
  decayTimer: number
  /** The one artist the player "shouldn't have dropped" (server-seeded). */
  isDroppedArtist: boolean
}

// Per-slot stat deltas. Money is included so the dev transaction log can
// surface the full effect of a slot in one event payload.
export interface PlayerStats {
  money: number
  coolness: number
  restedness: number
  luck: number
}

export interface SimEvent {
  kind: string
  description: string
  statDeltas: Partial<Record<keyof PlayerStats, number>>
}

export interface PlayerSimState {
  sessionId: string
  coolness: number
  restedness: number
  luck: number
  currentNeighborhood: Neighborhood
  scheduledSlots: TimeSlot[]
  // Phase 4 Plan 01: real relationship array replaces the Phase 3 stub.
  relationships: Relationship[]
  // Phase 4 Plan 03 stub — still inert this plan.
  drugInventory: never[]
  // Phase 4 Plan 01: the `droppedArtist` is the Artist the player "shouldn't
  // have dropped" — server-seeded at game start via seedDroppedArtist().
  // The canonical source of truth is the corresponding Relationship with
  // isDroppedArtist=true; this field is a quick-lookup mirror.
  droppedArtist: Artist | null
  // Faction alignment is DERIVED, never stored. Use deriveFactionAlignment()
  // in sim-engine to compute it on read. The field is intentionally omitted
  // from this interface so writing `playerSim.faction = ...` is a compile
  // error — if you want the faction, call the derivation function.
}

export interface SimState {
  dayNumber: number
  artMarketHotness: number     // 0.5–2.0 multiplier
  gentrificationLevel: number  // 1–10 integer
  nftHypeCycle: number         // 0–100
  neighborhoods: Neighborhood[]
}

// ─── Sim Message Payloads ───────────────────────────────────────────────────
// These are the message-shaped types that 03-02 will wire into the Zod
// inbound/outbound discriminated unions.

export interface SubmitSlotsPayload {
  slots: TimeSlot[]
}

export interface YourSimStateMessage {
  type: 'YOUR_SIM_STATE'
  simState: PlayerSimState
}

export interface SimDayResultMessage {
  type: 'SIM_DAY_RESULT'
  dayNumber: number
  events: SimEvent[]
}

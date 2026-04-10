import type * as Party from 'partykit/server'
import { z } from 'zod'
import type {
  GameState, Card, Artist, RoundResult,
  PublicGameState, PublicAuctionState,
  GamePhase, SimState, PlayerSimState, TimeSlot,
  Neighborhood, FinalAppraisal, BotPersonality,
} from '../src/types/game'
import { ARTISTS } from '../src/types/game'
import {
  emptyArtistCounts,
  playCard, playSecondCard, passSecondCard, setFixedPrice, acceptFixedPrice,
  passFixedPrice, placeOpenBid, endOpenAuction, placeOnceAroundBid,
  submitSealedBid, endRound, startGame,
} from '../src/lib/engine'
import {
  resolveSlots,
  advanceDay,
  seedDroppedArtist,
  progressLandlord,
  addDrugItem,
  removeDrugItem,
  applyDrugEffects,
  accumulateRisk,
  convertNft,
  purchaseNftWhitelist,
  applyNftHypeDrift,
  computeNftExchangeRate,
  updateRelationship,
  computeFinalAppraisal,
} from '../src/lib/sim-engine'
import {
  SIM_CONFIG,
  DRUG_CONFIG,
  DRUG_DEFINITIONS,
  NFT_CONFIG,
  NFT_ITEM_DEFINITIONS,
  createInitialPlayerSimState,
  createInitialSimState,
} from '../src/lib/sim-config'
import type { DrugItemKind, NftRarity, NftItem } from '../src/types/game'
import type { PlayerRecord } from '../src/types/game'
import { chooseBotCard, chooseBotBid, chooseBotSecondCard, chooseBotSlots } from '../src/lib/bot-engine'
import { BOT_NAMES, BOT_CONFIG } from '../src/lib/bot-config'

// ─── Inbound message schema (ENG-05) ──────────────────────────────────────────

const ArtistSchema = z.enum(['lite_metal', 'yoko', 'christine_p', 'karl_gitter', 'krypto'])
const AuctionTypeSchema = z.enum(['open', 'once_around', 'sealed_bid', 'fixed_price', 'double'])
const CardSchema = z.object({
  id: z.string(),
  artist: ArtistSchema,
  auctionType: AuctionTypeSchema,
})

// Phase 3 sim-loop schemas. SlotType and Neighborhood enums must match the
// string unions in src/types/game.ts and the NEIGHBORHOOD_DEFINITIONS keys.
const SlotTypeSchema = z.enum(['gallery_work', 'studio_visits', 'art_fair', 'opening', 'party', 'sleep'])
const NeighborhoodSchema = z.enum(['gallery', 'warehouse', 'flatlands', 'hotel', 'online'])
const TimeSlotSchema = z.object({
  id: z.string().min(1).max(64),
  type: SlotTypeSchema,
  neighborhood: NeighborhoodSchema.nullable(),
  // Phase 4 Plan 01 (T-4-01): client may declare which character this slot
  // contacts. The engine's updateRelationship silently no-ops on unknown ids,
  // so this is defense-in-depth validation rather than a trust boundary.
  targetCharacterId: z.string().min(1).max(64).optional(),
})

const InboundMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('JOIN'), name: z.string().min(1).max(30).regex(/^[\x20-\x7E]+$/), isHost: z.boolean().optional() }),
  z.object({ type: z.literal('SET_BOT_COUNT'), count: z.number().int().min(0).max(3) }),
  z.object({ type: z.literal('START_GAME') }),
  z.object({ type: z.literal('PLAY_CARD'), card: CardSchema }),
  z.object({ type: z.literal('PLAY_SECOND_CARD'), card: CardSchema }),
  z.object({ type: z.literal('PASS_SECOND_CARD') }),
  z.object({ type: z.literal('SET_FIXED_PRICE'), price: z.number().int().min(0) }),
  z.object({ type: z.literal('ACCEPT_FIXED_PRICE') }),
  z.object({ type: z.literal('PASS_FIXED_PRICE') }),
  z.object({ type: z.literal('PLACE_OPEN_BID'), amount: z.number().int().min(1) }),
  z.object({ type: z.literal('END_OPEN_AUCTION') }),
  z.object({ type: z.literal('PLACE_ONCE_AROUND_BID'), amount: z.number().int().min(0).nullable() }),
  z.object({ type: z.literal('SUBMIT_SEALED_BID'), amount: z.number().int().min(0) }),
  // Phase 3 sim-loop: player submits their day plan. Zod caps array length
  // at 20 to bound worst-case work per message (T-3-10 DoS mitigation).
  z.object({ type: z.literal('SUBMIT_SLOTS'), slots: z.array(TimeSlotSchema).max(20) }),
  // Phase 5 Plan 01: NFT parallel economy. CONVERT_NFT debits the player's
  // nftWallet and credits player.money at the hype-driven exchange rate.
  // PURCHASE_NFT_WHITELIST is a server-rolled draw with deterministic cost
  // (no client-supplied amount field — T-5-02 mitigation).
  z.object({ type: z.literal('CONVERT_NFT'), amount: z.number().int().min(1).max(1000) }),
  z.object({ type: z.literal('PURCHASE_NFT_WHITELIST') }),
])
type InboundMessage = z.infer<typeof InboundMessage>

// Exported for colocated Zod schema unit tests (see party/server.test.ts).
// The schema is not a secret — clients must be able to craft valid messages.
export { InboundMessage as InboundMessageSchema }

// ─── Server state ─────────────────────────────────────────────────────────────

interface Session {
  sessionId: string
  name: string
  isHost: boolean
  position: number
  money: number
  paintings: { artist: Artist; round: number }[]
  isBot?: boolean
  botPersonality?: BotPersonality
}

interface ServerState {
  game: GameState
  hands: Record<string, Card[]>       // sessionId → hand
  sessions: Record<string, Session>   // sessionId → session info
  lastRoundResult?: RoundResult       // persisted for reconnect recovery (ENG-09)
  // Phase 3 sim-loop: global sim snapshot (public) + per-player private state.
  // playerSim is NEVER serialized into broadcastStateSecure; it only flows
  // through broadcastSimStatePrivate (per-connection YOUR_SIM_STATE messages).
  // TODO(phase-3-storage): STATE.md blocker — PartyKit 0.0.115 storage backend
  // (SQLite 2 MB vs KV 128 KiB per key) needs verification before we split
  // this into multiple storage keys. For now the entire ServerState rides in
  // a single 'state' key (same as Phase 1/2) and we'll revisit after the
  // storage API shape is confirmed.
  sim: SimState
  playerSim: Record<string, PlayerSimState>
  // Phase 5 Plan 02: end-state appraisal support.
  //
  // neighborhoodHistory is a server-only append-only log of each player's
  // currentNeighborhood at the END of every resolveSlots call (i.e., after
  // the day's travel). Written only inside advanceFromSimDay — no inbound
  // message can touch it (T-5-13). Fed into computeFinalAppraisal when the
  // game transitions to game_over after the round-4 auction resolves.
  //
  // lastFinalAppraisals caches the per-session appraisals computed on the
  // game_over transition so reconnecting players can replay the broadcast
  // via onConnect (T-5-14).
  neighborhoodHistory: Record<string, Neighborhood[]>
  lastFinalAppraisals?: Record<string, FinalAppraisal>
  botCount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPlayerRecord(session: Session, hand: Card[]): PlayerRecord {
  return {
    id: session.sessionId,
    sessionId: session.sessionId,
    displayName: session.name,
    position: session.position,
    money: session.money,
    hand,
    paintings: session.paintings,
    isHost: session.isHost,
  }
}

/**
 * Phase 4 Plan 01 — "The Artist You Shouldn't Have Dropped" seed.
 *
 * Server-owned entropy: Math.random lives HERE (not in sim-engine, which is
 * pure). We pick one of the 5 auction artists uniformly per player at lobby
 * join time, so each player may get a different dropped artist, and the
 * engine-side seedDroppedArtist() helper mutates the relationship with
 * isDroppedArtist=true and score=-50 (RELATIONSHIP_CONFIG.droppedSeedScore).
 *
 * T-4-04 mitigation: clients cannot influence this choice — the server does
 * not accept any input that controls which artist is dropped.
 */
function seedFreshPlayerSim(sessionId: string): PlayerSimState {
  const base = createInitialPlayerSimState(sessionId)
  const picked = ARTISTS[Math.floor(Math.random() * ARTISTS.length)]
  return seedDroppedArtist(base, picked)
}

function sessionToPublicPlayer(session: Session): GameState['players'][0] {
  return {
    id: session.sessionId,
    sessionId: session.sessionId,
    displayName: session.name,
    position: session.position,
    money: session.money,
    paintingCount: session.paintings.length,
    paintings: session.paintings,
    isHost: session.isHost,
    // Phase 3 sim-loop public mirror fields. Real values will be projected
    // from PlayerSimState by sim-engine in 03-02; lobby default is 0.
    coolness: 0,
    prestige: 0,
  }
}

function syncSessions(state: ServerState): ServerState {
  // Keep sessions in sync with game.players money/paintings
  const updated = { ...state }
  updated.sessions = { ...state.sessions }
  for (const player of state.game.players) {
    const sess = updated.sessions[player.sessionId]
    if (sess) {
      updated.sessions[player.sessionId] = {
        ...sess,
        money: player.money,
        paintings: player.paintings,
      }
    }
  }
  return updated
}

// ─── Public-state projection (ENG-01, ENG-02) ────────────────────────────────
//
// Strips the deck (server-only) and replaces sealed-bid amounts with a
// presence-only marker, so no client receives information they should not
// have. Applied per-connection in broadcastStateSecure().
function derivePublicState(game: GameState): PublicGameState {
  const { deck: _deck, auction, ...rest } = game
  let publicAuction: PublicAuctionState | null = null
  if (auction) {
    const sealedBidsPresence: Record<number, true> = {}
    for (const idx of Object.keys(auction.sealedBids)) {
      sealedBidsPresence[Number(idx)] = true
    }
    publicAuction = { ...auction, sealedBids: sealedBidsPresence }
  }
  return { ...rest, deck: [] as never[], auction: publicAuction }
}

// ─── PartyKit Server ──────────────────────────────────────────────────────────

export default class GameServer implements Party.Server {
  private state: ServerState | null = null
  readonly room: Party.Room

  constructor(room: Party.Room) {
    this.room = room
  }

  async onStart() {
    this.state = await this.room.storage.get<ServerState>('state') ?? null
    if (this.state) {
      // Backfill sim-loop fields for any pre-Phase-3 persisted state.
      if (!this.state.sim) this.state.sim = createInitialSimState()
      if (!this.state.playerSim) this.state.playerSim = {}
      // Phase 5 Plan 02: backfill neighborhoodHistory for pre-05-02 states.
      if (!this.state.neighborhoodHistory) this.state.neighborhoodHistory = {}
      // Phase 7: backfill botCount for pre-07 states.
      if (this.state.botCount === undefined) this.state.botCount = 0
      // Also backfill game.phase and game.sim for old saved games that
      // predate the Phase 3 types extension.
      if (!this.state.game.phase) {
        this.state.game = { ...this.state.game, phase: { type: 'lobby' } }
      }
      if (!this.state.game.sim) {
        this.state.game = { ...this.state.game, sim: createInitialSimState() }
      }
      // If the loaded phase is mid-sim_day, re-arm the submission timeout.
      if (this.state.game.phase.type === 'sim_day') {
        this.startSimDayTimeout()
      }
    }
  }

  async onConnect(conn: Party.Connection) {
    if (!this.state) return
    // Send public projection of game state (deck stripped, sealed bids hidden)
    conn.send(JSON.stringify({ type: 'GAME_STATE', game: derivePublicState(this.state.game) }))
    // Send private hand
    const hand = this.state.hands[conn.id] ?? []
    conn.send(JSON.stringify({ type: 'YOUR_HAND', hand }))
    // Phase 3: send private sim state to this connection (mirrors YOUR_HAND).
    const simState = this.state.playerSim[conn.id]
    if (simState) {
      conn.send(JSON.stringify({ type: 'YOUR_SIM_STATE', simState }))
    }
    // ENG-09: replay last round summary if a round resolved while we were gone
    if (this.state.lastRoundResult && this.state.game.status === 'playing') {
      conn.send(JSON.stringify({ type: 'ROUND_END', result: this.state.lastRoundResult }))
    }
    // Phase 5 Plan 02: replay final appraisals to reconnecting players once
    // the game is in the game_over phase (T-5-14 mitigation).
    if (this.state.lastFinalAppraisals && this.state.game.status === 'game_over') {
      conn.send(
        JSON.stringify({
          type: 'GAME_OVER_APPRAISALS',
          appraisals: this.state.lastFinalAppraisals,
        }),
      )
    }
  }

  async onMessage(message: string, sender: Party.Connection) {
    let raw: unknown
    try { raw = JSON.parse(message) } catch { return }  // malformed JSON — drop silently

    const result = InboundMessage.safeParse(raw)
    if (!result.success) {
      sender.send(JSON.stringify({ type: 'ERROR', message: 'Invalid message' }))
      return
    }

    try {
      await this.handleMessage(result.data, sender)
    } catch (e) {
      sender.send(JSON.stringify({ type: 'ERROR', message: String(e) }))
    }
  }

  private async handleMessage(msg: InboundMessage, sender: Party.Connection) {
    const sessionId = sender.id as string

    // ── JOIN ────────────────────────────────────────────────────────────────
    if (msg.type === 'JOIN') {
      const name = msg.name
      // ENG-04: host status is server-assigned by connection order; never read isHost from the client message.

      if (!this.state) {
        // First player creates game
        const code = this.room.id.toUpperCase()
        const position = 0
        const session: Session = { sessionId, name, isHost: true, position, money: 100000, paintings: [] }

        const initialGame: GameState = {
          id: this.room.id,
          code,
          status: 'lobby',
          round: 1,
          currentPlayerIdx: 0,
          artistCounts: emptyArtistCounts(),
          roundValues: emptyArtistCounts(),
          roundHistory: [],
          deck: [],
          auction: null,
          players: [sessionToPublicPlayer(session)],
          // Phase 3: lobby default for the sim-loop fields.
          phase: { type: 'lobby' },
          sim: createInitialSimState(),
        }

        this.state = {
          game: initialGame,
          hands: { [sessionId]: [] },
          sessions: { [sessionId]: session },
          sim: createInitialSimState(),
          playerSim: { [sessionId]: seedFreshPlayerSim(sessionId) },
          neighborhoodHistory: { [sessionId]: [] },
          botCount: 0,
        }
      } else {
        // Check if already in session (reconnect)
        if (this.state.sessions[sessionId]) {
          sender.send(JSON.stringify({ type: 'GAME_STATE', game: derivePublicState(this.state.game) }))
          sender.send(JSON.stringify({ type: 'YOUR_HAND', hand: this.state.hands[sessionId] ?? [] }))
          // Phase 3: replay private sim state to reconnecting player.
          const simStateReconnect = this.state.playerSim[sessionId]
          if (simStateReconnect) {
            sender.send(JSON.stringify({ type: 'YOUR_SIM_STATE', simState: simStateReconnect }))
          }
          if (this.state.lastRoundResult && this.state.game.status === 'playing') {
            sender.send(JSON.stringify({ type: 'ROUND_END', result: this.state.lastRoundResult }))
          }
          return
        }
        // New player joining lobby
        if (this.state.game.status !== 'lobby') {
          sender.send(JSON.stringify({ type: 'ERROR', message: 'Game already started' }))
          return
        }
        if (this.state.game.players.length >= 5) {
          sender.send(JSON.stringify({ type: 'ERROR', message: 'Game is full' }))
          return
        }
        const position = this.state.game.players.length
        const session: Session = { sessionId, name, isHost: false, position, money: 100000, paintings: [] }
        this.state.sessions[sessionId] = session
        this.state.hands[sessionId] = []
        this.state.playerSim[sessionId] = seedFreshPlayerSim(sessionId)
        this.state.neighborhoodHistory[sessionId] = []
        this.state.game = {
          ...this.state.game,
          players: [...this.state.game.players, sessionToPublicPlayer(session)],
        }
      }

      await this.persist()
      this.broadcastStateSecure()
      return
    }

    // ── SET_BOT_COUNT (Phase 7) ────────────────────────────────────────────
    // Host-only, lobby-only. Bots count toward the 2-5 player limit (T-7-03,
    // T-7-06). Bot sessions are created at START_GAME, not here.
    if (msg.type === 'SET_BOT_COUNT') {
      if (!this.state) return
      if (this.state.game.status !== 'lobby') {
        sender.send(JSON.stringify({ type: 'ERROR', message: 'Can only set bots in lobby' }))
        return
      }
      const session = this.state.sessions[sessionId]
      if (!session?.isHost) {
        sender.send(JSON.stringify({ type: 'ERROR', message: 'Only host can set bot count' }))
        return
      }
      const humanCount = this.state.game.players.length
      if (msg.count + humanCount > 5) {
        sender.send(JSON.stringify({ type: 'ERROR', message: 'Total players (humans + bots) cannot exceed 5' }))
        return
      }
      this.state.botCount = msg.count
      await this.persist()
      this.broadcastStateSecure()
      return
    }

    // ── START_GAME ──────────────────────────────────────────────────────────
    if (msg.type === 'START_GAME') {
      if (!this.state) return
      const session = this.state.sessions[sessionId]
      if (!session?.isHost) { sender.send(JSON.stringify({ type: 'ERROR', message: 'Only host can start' })); return }

      // Phase 7: create bot sessions BEFORE player-count validation so bots
      // count toward the 2-5 limit. Bot sessionIds use 'bot-N' prefix which
      // no real WebSocket connection can claim (T-7-04).
      const botPersonalities: BotPersonality[] = ['conservative', 'aggressive', 'erratic']
      const humanCount = this.state.game.players.length
      for (let i = 0; i < this.state.botCount; i++) {
        const personality = botPersonalities[i % botPersonalities.length]
        const botSessionId = `bot-${i}`
        const botName = BOT_NAMES[personality][i % BOT_NAMES[personality].length]
        const botPosition = humanCount + i
        const botSession: Session = {
          sessionId: botSessionId,
          name: botName,
          isHost: false,
          position: botPosition,
          money: 100000,
          paintings: [],
          isBot: true,
          botPersonality: personality,
        }
        this.state.sessions[botSessionId] = botSession
        this.state.hands[botSessionId] = []
        this.state.playerSim[botSessionId] = seedFreshPlayerSim(botSessionId)
        this.state.neighborhoodHistory[botSessionId] = []
        this.state.game = {
          ...this.state.game,
          players: [...this.state.game.players, sessionToPublicPlayer(botSession)],
        }
      }

      if (this.state.game.players.length < 2) { sender.send(JSON.stringify({ type: 'ERROR', message: 'Need at least 2 players' })); return }

      // ENG-06: delegate to engine.startGame — no duplicated deal logic here.
      const allRecords = this.getAllPlayerRecords()
      const { updatedGame, updatedPlayers } = startGame(this.state.game, allRecords)

      // Sync engine-returned hands/money/paintings back into server state.
      const newHands: Record<string, Card[]> = {}
      const newSessions = { ...this.state.sessions }
      for (const p of updatedPlayers) {
        newHands[p.sessionId] = p.hand
        const sess = newSessions[p.sessionId]
        if (sess) newSessions[p.sessionId] = { ...sess, money: p.money, paintings: p.paintings }
      }

      // Phase 3: first sim_day opens BEFORE the first auction round. The
      // sim state has already been initialized at lobby creation time; here
      // we simply transition phase → sim_day(1) and arm the 60s timeout.
      const gameWithPhase: GameState = {
        ...updatedGame,
        phase: { type: 'sim_day', dayNumber: 1, submittedSessionIds: [] },
        sim: this.state.sim,
      }
      this.state = { ...this.state, game: gameWithPhase, hands: newHands, sessions: newSessions }
      this.startSimDayTimeout()
      await this.persist()
      this.broadcastStateSecure()
      this.broadcastHands()
      this.broadcastSimStatePrivate()
      // Phase 7: auto-submit bot slots for the first sim_day.
      await this.executeBotSimDay()
      return
    }

    // ── PLAY_CARD ───────────────────────────────────────────────────────────
    if (msg.type === 'PLAY_CARD') {
      if (!this.state) return
      const card = msg.card
      const playerRecord = this.getPlayerRecord(sessionId)
      if (!playerRecord) return

      const { updatedGame, updatedPlayer, roundEnded } = playCard(this.state.game, playerRecord, card)
      this.state.hands[sessionId] = updatedPlayer.hand

      if (roundEnded) {
        // Phase 7: extracted to handleRoundEnd for reuse by bot card plays.
        await this.handleRoundEnd(updatedGame, updatedPlayer, playerRecord)
      } else {
        this.state.game = updatedGame
        await this.persist()
        this.broadcastStateSecure()
        sender.send(JSON.stringify({ type: 'YOUR_HAND', hand: updatedPlayer.hand }))
        // Phase 7: next player might be a bot
        await this.executeBotTurn()
      }
      return
    }

    // ── PLAY_SECOND_CARD ────────────────────────────────────────────────────
    // ENG-03: faithful Knizia rule — only the player whose clockwise turn it
    // is to play/pass the second card may play it. They become the new
    // auctioneer for this lot.
    if (msg.type === 'PLAY_SECOND_CARD') {
      if (!this.state) return
      const session = this.state.sessions[sessionId]
      if (!session) return
      const auction = this.state.game.auction
      if (!auction || auction.status !== 'waiting_second' || auction.waitingSecondCardIdx !== session.position) {
        sender.send(JSON.stringify({ type: 'ERROR', message: 'Not your turn to play the second card' }))
        return
      }
      const card = msg.card
      const playerRecord = this.getPlayerRecord(sessionId)
      if (!playerRecord) return

      const { updatedGame, updatedPlayer } = playSecondCard(this.state.game, playerRecord, card)
      this.state.game = updatedGame
      this.state.hands[sessionId] = updatedPlayer.hand

      await this.persist()
      this.broadcastStateSecure()
      sender.send(JSON.stringify({ type: 'YOUR_HAND', hand: updatedPlayer.hand }))
      await this.executeBotTurn()
      return
    }

    // ── PASS_SECOND_CARD ────────────────────────────────────────────────────
    // ENG-03: clockwise pass mechanic. If every player passes back to the
    // original auctioneer, they take the single card for free and no auction
    // is held.
    if (msg.type === 'PASS_SECOND_CARD') {
      if (!this.state) return
      const session = this.state.sessions[sessionId]
      if (!session) return
      const auction = this.state.game.auction
      if (!auction || auction.status !== 'waiting_second' || auction.waitingSecondCardIdx !== session.position) {
        sender.send(JSON.stringify({ type: 'ERROR', message: 'Not your turn to pass' }))
        return
      }
      const { updatedGame, auctioneerTakesFree } = passSecondCard(this.state.game, session.position)
      this.state.game = updatedGame
      await this.persist()
      this.broadcastStateSecure()
      if (auctioneerTakesFree) {
        this.room.broadcast(JSON.stringify({ type: 'DOUBLE_AUCTION_ABANDONED' }))
      }
      await this.executeBotTurn()
      return
    }

    // ── SET_FIXED_PRICE ─────────────────────────────────────────────────────
    if (msg.type === 'SET_FIXED_PRICE') {
      if (!this.state) return
      this.state.game = setFixedPrice(this.state.game, msg.price)
      await this.persist()
      this.broadcastStateSecure()
      await this.executeBotTurn()
      return
    }

    // ── ACCEPT_FIXED_PRICE ──────────────────────────────────────────────────
    if (msg.type === 'ACCEPT_FIXED_PRICE') {
      if (!this.state) return
      const session = this.state.sessions[sessionId]
      if (!session) return
      const allRecords = this.getAllPlayerRecords()
      const { updatedGame, updatedPlayers } = acceptFixedPrice(this.state.game, allRecords, session.position)
      this.applyPlayerUpdates(updatedGame, updatedPlayers)
      await this.persist()
      this.broadcastStateSecure()
      await this.executeBotTurn()
      return
    }

    // ── PASS_FIXED_PRICE ────────────────────────────────────────────────────
    if (msg.type === 'PASS_FIXED_PRICE') {
      if (!this.state) return
      let updatedGame = passFixedPrice(this.state.game)
      // Check if auctioneer auto-wins (no one wanted it)
      if (updatedGame.auction?.leadingBidderIdx !== null &&
          updatedGame.auction?.leadingBidderIdx === updatedGame.auction?.auctioneerIdx) {
        const allRecords = this.getAllPlayerRecords()
        const { updatedGame: resolved, updatedPlayers } = acceptFixedPrice(updatedGame, allRecords, updatedGame.auction!.auctioneerIdx)
        this.applyPlayerUpdates(resolved, updatedPlayers)
      } else {
        this.state.game = updatedGame
      }
      await this.persist()
      this.broadcastStateSecure()
      await this.executeBotTurn()
      return
    }

    // ── PLACE_OPEN_BID ──────────────────────────────────────────────────────
    if (msg.type === 'PLACE_OPEN_BID') {
      if (!this.state) return
      const session = this.state.sessions[sessionId]
      if (!session) return
      this.state.game = placeOpenBid(this.state.game, session.position, msg.amount)
      await this.persist()
      this.broadcastStateSecure()
      await this.executeBotTurn()
      return
    }

    // ── END_OPEN_AUCTION ────────────────────────────────────────────────────
    if (msg.type === 'END_OPEN_AUCTION') {
      if (!this.state) return
      const allRecords = this.getAllPlayerRecords()
      const { updatedGame, updatedPlayers } = endOpenAuction(this.state.game, allRecords)
      this.applyPlayerUpdates(updatedGame, updatedPlayers)
      await this.persist()
      this.broadcastStateSecure()
      await this.executeBotTurn()
      return
    }

    // ── PLACE_ONCE_AROUND_BID ───────────────────────────────────────────────
    if (msg.type === 'PLACE_ONCE_AROUND_BID') {
      if (!this.state) return
      const session = this.state.sessions[sessionId]
      if (!session) return
      const allRecords = this.getAllPlayerRecords()
      const result = placeOnceAroundBid(this.state.game, allRecords, session.position, msg.amount)
      if ('updatedPlayers' in result) {
        this.applyPlayerUpdates(result.updatedGame, result.updatedPlayers)
      } else {
        this.state.game = result.updatedGame
      }
      await this.persist()
      this.broadcastStateSecure()
      await this.executeBotTurn()
      return
    }

    // ── SUBMIT_SEALED_BID ───────────────────────────────────────────────────
    if (msg.type === 'SUBMIT_SEALED_BID') {
      if (!this.state) return
      const session = this.state.sessions[sessionId]
      if (!session) return
      const allRecords = this.getAllPlayerRecords()
      const result = submitSealedBid(this.state.game, allRecords, session.position, msg.amount)
      if ('updatedPlayers' in result && result.updatedPlayers) {
        this.applyPlayerUpdates(result.updatedGame, result.updatedPlayers)
      } else {
        this.state.game = result.updatedGame
      }
      await this.persist()
      this.broadcastStateSecure()
      await this.executeBotTurn()
      return
    }

    // ── SUBMIT_SLOTS (Phase 3 sim-loop) ─────────────────────────────────────
    // Player submits their day plan. We stash the slots on the owning
    // PlayerSimState but DO NOT resolve them yet — resolution happens once in
    // advanceFromSimDay (either when everyone has submitted or when the 60s
    // hard timeout fires). This guarantees all players see the world state
    // advance simultaneously, and makes the resolution path idempotent.
    if (msg.type === 'SUBMIT_SLOTS') {
      if (!this.state) return
      if (this.state.game.phase.type !== 'sim_day') {
        sender.send(JSON.stringify({ type: 'ERROR', message: 'Not in sim day phase' }))
        return
      }
      const session = this.state.sessions[sessionId]
      if (!session) {
        sender.send(JSON.stringify({ type: 'ERROR', message: 'Unknown player' }))
        return
      }
      const existingSim = this.state.playerSim[sessionId]
      if (!existingSim) {
        sender.send(JSON.stringify({ type: 'ERROR', message: 'No sim state for player' }))
        return
      }
      // Stash the slots — resolution is deferred to advanceFromSimDay.
      this.state.playerSim[sessionId] = { ...existingSim, scheduledSlots: msg.slots }

      const phase = this.state.game.phase
      const submitted = new Set(phase.submittedSessionIds)
      submitted.add(sessionId)
      this.state.game = {
        ...this.state.game,
        phase: { ...phase, submittedSessionIds: Array.from(submitted) },
      }

      await this.persist()
      this.broadcastStateSecure()
      // Also send this player's updated private sim state (slots echo).
      sender.send(JSON.stringify({ type: 'YOUR_SIM_STATE', simState: this.state.playerSim[sessionId] }))

      // If every known player has submitted, advance immediately.
      const activeSessionIds = Object.keys(this.state.sessions)
      if (activeSessionIds.length > 0 && activeSessionIds.every(id => submitted.has(id))) {
        await this.advanceFromSimDay('all_submitted')
        // Phase 7: after sim day resolves, check if first turn is a bot
        await this.executeBotTurn()
      }
      return
    }

    // ── CONVERT_NFT (Phase 5 Plan 01) ───────────────────────────────────────
    //
    // Player explicitly converts nftWallet currency to player.money at the
    // hype-driven exchange rate. Gating mirrors SUBMIT_SLOTS: must be in a
    // sim_day or auction_round phase, must be a known session, and the
    // player's nftWalletUnlocked must be true (T-5-05: only the threshold-
    // cross detector inside advanceFromSimDay can flip that bit).
    if (msg.type === 'CONVERT_NFT') {
      if (!this.state) return
      const phaseType = this.state.game.phase.type
      if (phaseType !== 'sim_day' && phaseType !== 'auction_round') {
        sender.send(JSON.stringify({ type: 'ERROR', message: 'NFT actions only available during play' }))
        return
      }
      const session = this.state.sessions[sessionId]
      if (!session) {
        sender.send(JSON.stringify({ type: 'ERROR', message: 'Unknown player' }))
        return
      }
      const ps = this.state.playerSim[sessionId]
      if (!ps) {
        sender.send(JSON.stringify({ type: 'ERROR', message: 'No sim state for player' }))
        return
      }
      if (!ps.nftWalletUnlocked) {
        sender.send(JSON.stringify({ type: 'ERROR', message: 'NFT wallet locked' }))
        return
      }
      const rate = computeNftExchangeRate(this.state.sim.nftHypeCycle)
      const { updatedPlayerSim, moneyDelta } = convertNft(ps, msg.amount, rate)
      if (moneyDelta === 0) {
        sender.send(JSON.stringify({ type: 'ERROR', message: 'NFT conversion rejected' }))
        return
      }
      this.state.playerSim[sessionId] = updatedPlayerSim
      // Mirror moneyDelta onto the public player projection.
      this.state.game = {
        ...this.state.game,
        players: this.state.game.players.map(p =>
          p.sessionId === sessionId ? { ...p, money: p.money + moneyDelta } : p,
        ),
      }
      this.state = syncSessions(this.state)
      await this.persist()
      this.broadcastStateSecure()
      sender.send(JSON.stringify({ type: 'YOUR_SIM_STATE', simState: this.state.playerSim[sessionId] }))
      return
    }

    // ── PURCHASE_NFT_WHITELIST (Phase 5 Plan 01) ────────────────────────────
    //
    // Server-rolled NFT draw. Cost is a server constant (NFT_CONFIG.whitelist
    // Cost — T-5-02). On a 50/50 hit, the server picks a uniform NftRarity,
    // generates an id (crypto.randomUUID with the same Date.now+Math.random
    // fallback drug acquisition uses), and constructs an NftItem from
    // NFT_ITEM_DEFINITIONS[rarity]. On a miss, the cost is still debited.
    //
    // Faction reaction pass runs unconditionally on every successful purchase
    // (T-5-06): Sculptor relationships -3, Social/Political -5. If at least
    // one Social/Political relationship was hit, broadcast NFT_DENOUNCEMENT
    // to the room with the player's displayName.
    if (msg.type === 'PURCHASE_NFT_WHITELIST') {
      if (!this.state) return
      const phaseType = this.state.game.phase.type
      if (phaseType !== 'sim_day' && phaseType !== 'auction_round') {
        sender.send(JSON.stringify({ type: 'ERROR', message: 'NFT actions only available during play' }))
        return
      }
      const session = this.state.sessions[sessionId]
      if (!session) {
        sender.send(JSON.stringify({ type: 'ERROR', message: 'Unknown player' }))
        return
      }
      const ps = this.state.playerSim[sessionId]
      if (!ps) {
        sender.send(JSON.stringify({ type: 'ERROR', message: 'No sim state for player' }))
        return
      }
      if (!ps.nftWalletUnlocked) {
        sender.send(JSON.stringify({ type: 'ERROR', message: 'NFT wallet locked' }))
        return
      }
      if (ps.nftWallet < NFT_CONFIG.whitelistCost) {
        sender.send(JSON.stringify({ type: 'ERROR', message: 'Insufficient NFT balance' }))
        return
      }

      // Server-side entropy boundary: Math.random and crypto.randomUUID stay
      // here. The pure engine receives the constructed NftItem (or null on
      // a miss) and only does the debit + append.
      const NFT_RARITIES: NftRarity[] = ['common', 'uncommon', 'rare', 'legendary']
      let item: NftItem | null = null
      if (Math.random() < 0.5) {
        const rarity = NFT_RARITIES[Math.floor(Math.random() * NFT_RARITIES.length)]
        const def = NFT_ITEM_DEFINITIONS[rarity]
        const id =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `nft-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
        item = {
          id,
          rarity,
          displayLabel: def.displayLabel,
          displayMeta: def.displayMeta,
          baseValue: def.baseValue,
        }
      }
      let next = purchaseNftWhitelist(ps, item)

      // Faction reaction pass — runs on every successful purchase, regardless
      // of whether an item was rolled. The cost was paid; the denouncement
      // happens. T-5-06 mitigation: client cannot omit this step.
      let socialPoliticalHit = false
      let nextRelationships = next.relationships
      for (const r of next.relationships) {
        if (r.factionAlignment === 'sculptors') {
          nextRelationships = updateRelationship(
            nextRelationships,
            r.characterId,
            NFT_CONFIG.sculptorReactionDelta,
          )
        } else if (r.factionAlignment === 'social_political') {
          nextRelationships = updateRelationship(
            nextRelationships,
            r.characterId,
            NFT_CONFIG.socialPoliticalReactionDelta,
          )
          socialPoliticalHit = true
        }
      }
      next = { ...next, relationships: nextRelationships }
      this.state.playerSim[sessionId] = next

      await this.persist()
      this.broadcastStateSecure()
      sender.send(JSON.stringify({ type: 'YOUR_SIM_STATE', simState: this.state.playerSim[sessionId] }))

      if (socialPoliticalHit) {
        const copy = NFT_CONFIG.denouncementCopyTemplate.replace('{name}', session.name)
        this.room.broadcast(
          JSON.stringify({
            type: 'NFT_DENOUNCEMENT',
            sessionId,
            displayName: session.name,
            copy,
          }),
        )
      }
      return
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private getPlayerRecord(sessionId: string): PlayerRecord | null {
    if (!this.state) return null
    const session = this.state.sessions[sessionId]
    if (!session) return null
    return buildPlayerRecord(session, this.state.hands[sessionId] ?? [])
  }

  private getAllPlayerRecords(): PlayerRecord[] {
    if (!this.state) return []
    return Object.values(this.state.sessions)
      .sort((a, b) => a.position - b.position)
      .map(sess => buildPlayerRecord(sess, this.state!.hands[sess.sessionId] ?? []))
  }

  private applyPlayerUpdates(updatedGame: GameState, updatedPlayers: PlayerRecord[]) {
    if (!this.state) return
    updatedPlayers.forEach(p => {
      this.state!.hands[p.sessionId] = p.hand
      const sess = this.state!.sessions[p.sessionId]
      if (sess) {
        this.state!.sessions[p.sessionId] = { ...sess, money: p.money, paintings: p.paintings }
      }
    })
    // Clear the completed auction so the next player can play a card.
    // The engine sets auction.status = 'completed' on resolve but leaves the
    // object in place; clearing it to null is the server's responsibility.
    this.state.game = { ...updatedGame, auction: null }
  }

  private broadcastStateSecure() {
    if (!this.state) return
    const publicGame = derivePublicState(this.state.game)
    // Use room.broadcast for hibernation-safe delivery on Cloudflare DO.
    this.room.broadcast(JSON.stringify({ type: 'GAME_STATE', game: publicGame }))
  }

  private broadcastHands() {
    if (!this.state) return
    // Hands are per-connection (private), so we must iterate.
    for (const conn of this.room.getConnections()) {
      const hand = this.state.hands[conn.id] ?? []
      conn.send(JSON.stringify({ type: 'YOUR_HAND', hand }))
    }
  }

  // ─── Phase 3 sim-loop internals ────────────────────────────────────────────
  //
  // Privacy invariant: state.playerSim is NEVER referenced inside
  // derivePublicState or broadcastStateSecure. The only path from the server
  // to the client for a PlayerSimState is broadcastSimStatePrivate below,
  // which iterates connections and looks up state.playerSim[conn.id]. This
  // mirrors the YOUR_HAND pattern from Phase 1.

  private simDayTimer: ReturnType<typeof setTimeout> | null = null
  private advancingFromSimDay = false

  private startSimDayTimeout() {
    this.clearSimDayTimeout()
    this.simDayTimer = setTimeout(async () => {
      // Phase 7: auto-submit bot slots before timeout-driven advance
      await this.executeBotSimDay()
      void this.advanceFromSimDay('timeout')
    }, SIM_CONFIG.SUBMISSION_TIMEOUT_MS)
  }

  private clearSimDayTimeout() {
    if (this.simDayTimer) {
      clearTimeout(this.simDayTimer)
      this.simDayTimer = null
    }
  }

  private broadcastSimStatePrivate() {
    if (!this.state) return
    for (const conn of this.room.getConnections()) {
      const simState = this.state.playerSim[conn.id]
      if (simState) {
        conn.send(JSON.stringify({ type: 'YOUR_SIM_STATE', simState }))
      }
    }
  }

  /**
   * Resolve all player day plans and transition sim_day → auction_round.
   * Idempotent via this.advancingFromSimDay guard: protects against the
   * timeout firing while the final submission is mid-processing (T-3-11).
   */
  private async advanceFromSimDay(_reason: 'all_submitted' | 'timeout') {
    if (!this.state) return
    if (this.advancingFromSimDay) return
    if (this.state.game.phase.type !== 'sim_day') return
    this.advancingFromSimDay = true
    try {
      this.clearSimDayTimeout()

      const sim = this.state.sim
      const players = this.state.game.players

      // Resolve each player's day in position order. resolveSlots is a no-op
      // for empty slot arrays — that's the timeout-with-no-submission path.
      //
      // Phase 4 Plan 01: capture the per-player contactedThisDay sets so we
      // can feed them into advanceDay → decayRelationships. This Map is
      // local to this function call and never broadcast (T-4-05: server-
      // derived from engine output, not trusted client input).
      const updatedPlayerSimMap: Record<string, PlayerSimState> = {}
      const contactedByPlayer = new Map<string, Set<string>>()
      // Phase 5 Plan 01: capture each player's coolness BEFORE resolveSlots
      // so the threshold-cross detector below can compare prior vs current
      // and flip nftWalletUnlocked exactly once per player.
      const priorCoolnessBySession = new Map<string, number>()
      for (const p of players) {
        const ps = this.state.playerSim[p.sessionId]
        if (ps) priorCoolnessBySession.set(p.sessionId, ps.coolness)
      }
      // Phase 4 Plan 03: capture per-player day plan BEFORE resolveSlots
      // clears scheduledSlots, so the acquisition/use passes below can
      // re-inspect the plan for flatlands/hotel/party slots.
      const submittedPlansBySession = new Map<string, TimeSlot[]>()
      const updatedPlayers = players.map(p => {
        const ps = this.state!.playerSim[p.sessionId]
        if (!ps) return p
        submittedPlansBySession.set(p.sessionId, ps.scheduledSlots ?? [])
        const { updatedPlayerSim, updatedPlayerMoney, contactedThisDay } = resolveSlots(
          ps,
          ps.scheduledSlots ?? [],
          sim,
          p,
        )
        updatedPlayerSimMap[p.sessionId] = { ...updatedPlayerSim, scheduledSlots: [] }
        contactedByPlayer.set(p.sessionId, contactedThisDay)
        // Phase 5 Plan 02: append the post-travel neighborhood to the
        // server-only history log. This is the input to computeFinalAppraisal
        // at game_over (T-5-13 — written only here, no inbound surface).
        const history = this.state!.neighborhoodHistory[p.sessionId] ?? []
        this.state!.neighborhoodHistory[p.sessionId] = [
          ...history,
          updatedPlayerSim.currentNeighborhood,
        ]
        // Mirror coolness onto the public player projection so opponents see it.
        return {
          ...p,
          money: updatedPlayerMoney,
          coolness: updatedPlayerSim.coolness,
        }
      })

      // ── Phase 4 Plan 03: drug acquisition rolls ───────────────────────
      //
      // For each flatlands/hotel slot in the submitted plan, roll
      // Math.random() < DRUG_CONFIG.acquisitionProbability[neighborhood].
      // Entropy stays server-side — the pure engine never touches
      // Math.random. On a hit, the server picks a uniform DrugItemKind,
      // generates a crypto.randomUUID id, and calls addDrugItem.
      //
      // T-4-12 mitigation: clients cannot inject drugs via SUBMIT_SLOTS —
      // the Zod schema has no drug fields, and addDrugItem is only called
      // here, inside advanceFromSimDay.
      const DRUG_KINDS = Object.keys(DRUG_DEFINITIONS) as DrugItemKind[]
      for (const p of players) {
        let ps = updatedPlayerSimMap[p.sessionId]
        if (!ps) continue
        const plan = submittedPlansBySession.get(p.sessionId) ?? []
        for (const s of plan) {
          if (s.neighborhood === 'flatlands' || s.neighborhood === 'hotel') {
            const probability = DRUG_CONFIG.acquisitionProbability[s.neighborhood]
            if (Math.random() < probability) {
              const kind = DRUG_KINDS[Math.floor(Math.random() * DRUG_KINDS.length)]
              const id =
                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                  ? crypto.randomUUID()
                  : `drug-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
              ps = addDrugItem(ps, kind, id)
            }
          }
        }
        updatedPlayerSimMap[p.sessionId] = ps
      }

      // ── Phase 4 Plan 03: party-slot drug use ──────────────────────────
      //
      // For each 'party' slot in the submitted plan, if the player has at
      // least one drug item, consume drugs[0]: apply its effects then
      // remove it by id. The coolness change is mirrored onto the
      // PublicPlayer entry the same way resolveSlots already does, so
      // opponents see the party-fuelled coolness bump without seeing the
      // drug inventory itself (T-4-14: drugs stay in PlayerSimState).
      for (let i = 0; i < players.length; i++) {
        const p = players[i]
        let ps = updatedPlayerSimMap[p.sessionId]
        if (!ps) continue
        const plan = submittedPlansBySession.get(p.sessionId) ?? []
        let coolnessMirror = updatedPlayers[i].coolness
        for (const s of plan) {
          if (s.type === 'party' && ps.drugs.length > 0) {
            const item = ps.drugs[0]
            const { updatedPlayerSim: afterEffects } = applyDrugEffects(ps, item.kind)
            ps = removeDrugItem(afterEffects, item.id)
            coolnessMirror = ps.coolness
          }
        }
        updatedPlayerSimMap[p.sessionId] = ps
        updatedPlayers[i] = { ...updatedPlayers[i], coolness: coolnessMirror }
      }

      // ── Phase 5 Plan 01: Coolness threshold-cross detector ───────────
      //
      // After drug-use bumps coolness (the highest coolness moment in the
      // day), check whether any player's coolness crossed NFT_CONFIG.unlock
      // Threshold from below. If so, flip nftWalletUnlocked once and
      // dispatch an NFT_DM unicast to that player's connection. The bit
      // can ONLY be set here (T-5-05 mitigation) — no inbound message can
      // flip it.
      for (const p of players) {
        const ps = updatedPlayerSimMap[p.sessionId]
        if (!ps) continue
        if (ps.nftWalletUnlocked) continue
        const prior = priorCoolnessBySession.get(p.sessionId) ?? ps.coolness
        if (prior < NFT_CONFIG.unlockThreshold && ps.coolness >= NFT_CONFIG.unlockThreshold) {
          updatedPlayerSimMap[p.sessionId] = { ...ps, nftWalletUnlocked: true }
          // Unicast NFT_DM to the connection whose conn.id === sessionId
          // (T-5-07 mitigation). Mirrors the broadcastSimStatePrivate iteration.
          for (const conn of this.room.getConnections()) {
            if (conn.id === p.sessionId) {
              conn.send(JSON.stringify({ type: 'NFT_DM', copy: NFT_CONFIG.dmCopy }))
              break
            }
          }
        }
      }

      // Phase 4 Plan 02: landlord arc progression. Runs per player AFTER
      // the resolveSlots loop but BEFORE advanceDay, so the landlordStage
      // advance is visible in the same sim_day → auction_round transition
      // that the rest of the day's resolution emits. progressLandlord is a
      // pure one-way ratchet gated on PublicPlayer.prestige (server-
      // authoritative, T-4-10). Per-player private mutation — landlord
      // state lives in PlayerSimState and never reaches derivePublicState.
      for (const p of players) {
        const ps = updatedPlayerSimMap[p.sessionId]
        if (!ps) continue
        const { updatedPlayerSim: afterLandlord } = progressLandlord(ps, p.prestige)
        updatedPlayerSimMap[p.sessionId] = afterLandlord
      }

      // ── Phase 4 Plan 03: per-player risk accumulation ─────────────────
      //
      // Runs AFTER progressLandlord and BEFORE advanceDay. Carrying more
      // than DRUG_CONFIG.riskThreshold units bumps risk by riskPerDay
      // (clamped to 100). An empty inventory decays risk by 1. Pure
      // function; accumulateRisk is the only writer for the risk field
      // (T-4-15 mitigation).
      for (const p of players) {
        const ps = updatedPlayerSimMap[p.sessionId]
        if (!ps) continue
        updatedPlayerSimMap[p.sessionId] = accumulateRisk(ps)
      }

      // Advance global sim state. Phase 5 Plan 01 wires applyNftHypeDrift
      // into the nft drift parameter — Math.random stays here (entropy
      // boundary, T-5-09); the engine receives the post-clamp delta.
      const nftRandomDelta = (Math.random() * 2 - 1) * NFT_CONFIG.hypeDriftRange
      const nextHype = applyNftHypeDrift(sim.nftHypeCycle, nftRandomDelta)
      const { updatedSim, updatedPlayerSims } = advanceDay(
        sim,
        Object.values(updatedPlayerSimMap),
        { hotness: 0, gent: 0, nft: nextHype - sim.nftHypeCycle },
        contactedByPlayer,
      )
      this.state.sim = updatedSim
      // Merge the decayed relationship state back into updatedPlayerSimMap.
      const decayedById: Record<string, PlayerSimState> = {}
      for (const ps of updatedPlayerSims) decayedById[ps.sessionId] = ps
      this.state.playerSim = { ...this.state.playerSim, ...decayedById }

      // Transition phase: sim_day → auction_round. The engine's round
      // counter (game.round) is the authoritative auction roundNumber.
      const nextPhase: GamePhase = {
        type: 'auction_round',
        roundNumber: this.state.game.round,
      }
      this.state.game = {
        ...this.state.game,
        players: updatedPlayers,
        phase: nextPhase,
        sim: updatedSim,
      }

      // Keep Session.money in lockstep with game.players (syncSessions is a
      // pure helper that returns a rebuilt ServerState).
      this.state = syncSessions(this.state)

      await this.persist()
      this.broadcastStateSecure()
      this.broadcastSimStatePrivate()
      // Phase 7: after transitioning to auction_round, check if first turn is a bot
      await this.executeBotTurn()
    } finally {
      this.advancingFromSimDay = false
    }
  }

  // ─── Phase 7: Bot turn execution ──────────────────────────────────────────
  //
  // After any state change, check if the next action belongs to a bot. If so,
  // execute it immediately via bot-engine + the same engine functions humans
  // use. The botActing guard prevents re-entrant loops (T-7-05).

  private botActing = false

  private async executeBotTurn(): Promise<void> {
    if (this.botActing) return
    if (!this.state) return
    const game = this.state.game
    if (game.status !== 'playing') return
    if (game.phase.type !== 'auction_round') return

    this.botActing = true
    try {
      // No active auction: check if it's a bot's turn to play a card
      if (!game.auction) {
        const currentPlayer = game.players[game.currentPlayerIdx]
        const session = this.state.sessions[currentPlayer?.sessionId]
        if (!session?.isBot || !session.botPersonality) return

        const hand = this.state.hands[session.sessionId] ?? []
        if (hand.length === 0) return

        const card = chooseBotCard(hand, game, session.botPersonality, Math.random())
        const playerRecord = this.getPlayerRecord(session.sessionId)
        if (!playerRecord) return

        const { updatedGame, updatedPlayer, roundEnded } = playCard(game, playerRecord, card)
        this.state.hands[session.sessionId] = updatedPlayer.hand

        if (roundEnded) {
          await this.handleRoundEnd(updatedGame, updatedPlayer, playerRecord)
        } else {
          this.state.game = updatedGame
          await this.persist()
          this.broadcastStateSecure()
        }
        // Recurse: the next player might also be a bot
        this.botActing = false
        await this.executeBotTurn()
        return
      }

      // Active auction: delegate to bot auction handler
      await this.executeBotAuctionAction()
    } finally {
      this.botActing = false
    }
  }

  private async executeBotAuctionAction(): Promise<void> {
    if (!this.state?.game.auction) return
    const auction = this.state.game.auction
    const game = this.state.game

    // WAITING_SECOND: is it a bot's turn to play/pass the second card?
    if (auction.status === 'waiting_second') {
      const waitingPlayer = game.players[auction.waitingSecondCardIdx]
      const session = this.state.sessions[waitingPlayer?.sessionId]
      if (!session?.isBot || !session.botPersonality) return

      const hand = this.state.hands[session.sessionId] ?? []
      const secondCard = chooseBotSecondCard(hand, auction, session.botPersonality, Math.random())
      if (secondCard) {
        const playerRecord = this.getPlayerRecord(session.sessionId)!
        const { updatedGame, updatedPlayer } = playSecondCard(game, playerRecord, secondCard)
        this.state.game = updatedGame
        this.state.hands[session.sessionId] = updatedPlayer.hand
      } else {
        const { updatedGame: ug, auctioneerTakesFree } = passSecondCard(game, auction.waitingSecondCardIdx)
        this.state.game = ug
        if (auctioneerTakesFree) {
          this.room.broadcast(JSON.stringify({ type: 'DOUBLE_AUCTION_ABANDONED' }))
        }
      }
      await this.persist()
      this.broadcastStateSecure()
      this.botActing = false
      await this.executeBotTurn()
      return
    }

    // SET_PRICE: is the auctioneer a bot who needs to set the fixed price?
    if (auction.status === 'set_price') {
      const auctioneer = game.players[auction.auctioneerIdx]
      const session = this.state.sessions[auctioneer?.sessionId]
      if (!session?.isBot || !session.botPersonality) return
      const artist = auction.cards[0]?.artist
      const perceived = (game.roundValues[artist] ?? 0) + (game.artistCounts[artist] ?? 0) * 5000
      const price = Math.floor(perceived * (BOT_CONFIG.valuationMultiplier[session.botPersonality] ?? 1.0))
      this.state.game = setFixedPrice(game, Math.max(1000, price))
      await this.persist()
      this.broadcastStateSecure()
      this.botActing = false
      await this.executeBotTurn()
      return
    }

    // ACTIVE auction: dispatch by type
    if (auction.status !== 'active') return

    if (auction.auctionType === 'open') {
      await this.executeBotOpenBids()
      return
    }

    if (auction.auctionType === 'once_around') {
      const currentPlayer = game.players[auction.onceAroundCurrentIdx]
      const session = this.state.sessions[currentPlayer?.sessionId]
      if (!session?.isBot || !session.botPersonality) return
      const bid = chooseBotBid(auction, game, session.botPersonality, session.money, Math.random())
      const allRecords = this.getAllPlayerRecords()
      const result = placeOnceAroundBid(game, allRecords, session.position, bid)
      if ('updatedPlayers' in result) {
        this.applyPlayerUpdates(result.updatedGame, result.updatedPlayers)
      } else {
        this.state.game = result.updatedGame
      }
      await this.persist()
      this.broadcastStateSecure()
      this.botActing = false
      await this.executeBotTurn()
      return
    }

    if (auction.auctionType === 'sealed_bid') {
      for (const p of game.players) {
        const sess = this.state.sessions[p.sessionId]
        if (!sess?.isBot || !sess.botPersonality) continue
        if (auction.sealedBids[p.position ?? sess.position] !== undefined) continue
        const bid = chooseBotBid(auction, game, sess.botPersonality, sess.money, Math.random())
        const allRecords = this.getAllPlayerRecords()
        const result = submitSealedBid(this.state.game, allRecords, sess.position, bid ?? 0)
        if ('updatedPlayers' in result && result.updatedPlayers) {
          this.applyPlayerUpdates(result.updatedGame, result.updatedPlayers)
        } else {
          this.state.game = result.updatedGame
        }
      }
      await this.persist()
      this.broadcastStateSecure()
      this.botActing = false
      await this.executeBotTurn()
      return
    }

    if (auction.auctionType === 'fixed_price') {
      const currentPlayer = game.players[auction.onceAroundCurrentIdx]
      const session = this.state.sessions[currentPlayer?.sessionId]
      if (!session?.isBot || !session.botPersonality) return
      const bid = chooseBotBid(auction, game, session.botPersonality, session.money, Math.random())
      if (bid !== null) {
        const allRecords = this.getAllPlayerRecords()
        const { updatedGame, updatedPlayers } = acceptFixedPrice(game, allRecords, session.position)
        this.applyPlayerUpdates(updatedGame, updatedPlayers)
      } else {
        let updatedGame = passFixedPrice(game)
        if (updatedGame.auction?.leadingBidderIdx !== null &&
            updatedGame.auction?.leadingBidderIdx === updatedGame.auction?.auctioneerIdx) {
          const allRecords = this.getAllPlayerRecords()
          const { updatedGame: resolved, updatedPlayers } = acceptFixedPrice(updatedGame, allRecords, updatedGame.auction!.auctioneerIdx)
          this.applyPlayerUpdates(resolved, updatedPlayers)
        } else {
          this.state.game = updatedGame
        }
      }
      await this.persist()
      this.broadcastStateSecure()
      this.botActing = false
      await this.executeBotTurn()
      return
    }
  }

  private async executeBotOpenBids(): Promise<void> {
    if (!this.state?.game.auction) return
    const game = this.state.game
    const auction = game.auction!

    // Each bot gets one chance to bid
    for (const p of game.players) {
      const sess = this.state.sessions[p.sessionId]
      if (!sess?.isBot || !sess.botPersonality) continue
      const bid = chooseBotBid(this.state.game.auction!, this.state.game, sess.botPersonality, sess.money, Math.random())
      if (bid !== null) {
        this.state.game = placeOpenBid(this.state.game, sess.position, bid)
      }
    }

    // If the auctioneer is a bot and leading bidder is a bot (or null),
    // auto-end the auction so it doesn't hang
    const auctioneer = game.players[auction.auctioneerIdx]
    const auctioneerSess = this.state.sessions[auctioneer?.sessionId]
    if (auctioneerSess?.isBot && this.state.game.auction) {
      const currentAuction = this.state.game.auction
      const leadingIdx = currentAuction.leadingBidderIdx
      // End auction if: there's a bid OR no one bid (auctioneer takes it)
      const allRecords = this.getAllPlayerRecords()
      const { updatedGame, updatedPlayers } = endOpenAuction(this.state.game, allRecords)
      this.applyPlayerUpdates(updatedGame, updatedPlayers)
    }

    await this.persist()
    this.broadcastStateSecure()
    this.botActing = false
    await this.executeBotTurn()
  }

  /**
   * Phase 7: handle round-end logic extracted for reuse by both human PLAY_CARD
   * and bot card plays. Performs endRound, session sync, phase transition,
   * final appraisals, persist, broadcast.
   */
  private async handleRoundEnd(
    updatedGame: GameState,
    updatedPlayer: PlayerRecord,
    playerRecord: PlayerRecord,
  ): Promise<void> {
    if (!this.state) return
    const allRecords = this.getAllPlayerRecords()
    allRecords[playerRecord.position] = { ...allRecords[playerRecord.position], hand: updatedPlayer.hand }
    const { updatedGame: finalGame, updatedPlayers, result } = endRound(updatedGame, allRecords)

    updatedPlayers.forEach(p => {
      this.state!.hands[p.sessionId] = p.hand
      const sess = this.state!.sessions[p.sessionId]
      if (sess) {
        this.state!.sessions[p.sessionId] = { ...sess, money: p.money, paintings: p.paintings }
      }
    })

    let nextPhase: GamePhase
    if (finalGame.status === 'game_over') {
      nextPhase = { type: 'game_over' }
    } else {
      const nextDayNumber = this.state.sim.dayNumber + 1
      nextPhase = { type: 'sim_day', dayNumber: nextDayNumber, submittedSessionIds: [] }
    }
    this.state.game = { ...finalGame, phase: nextPhase, sim: this.state.sim }
    if (nextPhase.type === 'sim_day') {
      this.startSimDayTimeout()
    } else {
      this.clearSimDayTimeout()
    }

    let finalAppraisals: Record<string, FinalAppraisal> | null = null
    if (finalGame.status === 'game_over') {
      finalAppraisals = {}
      for (const p of finalGame.players) {
        const ps = this.state.playerSim[p.sessionId]
        if (!ps) continue
        finalAppraisals[p.sessionId] = computeFinalAppraisal({
          sessionId: p.sessionId,
          displayName: p.displayName,
          finalMoney: p.money,
          playerSim: ps,
          neighborhoodHistory: this.state.neighborhoodHistory[p.sessionId] ?? [],
        })
      }
      this.state.lastFinalAppraisals = finalAppraisals
    }
    this.state.lastRoundResult = result
    await this.persist()
    this.broadcastStateSecure()
    this.broadcastHands()
    this.room.broadcast(JSON.stringify({ type: 'ROUND_END', result }))
    if (finalAppraisals) {
      this.room.broadcast(
        JSON.stringify({
          type: 'GAME_OVER_APPRAISALS',
          appraisals: finalAppraisals,
        }),
      )
    }

    // Phase 7: after round-end, if next phase is sim_day, auto-submit bot slots
    if (nextPhase.type === 'sim_day') {
      await this.executeBotSimDay()
    }
  }

  /**
   * Phase 7: auto-submit bot slots when phase transitions to sim_day.
   * Bots use chooseBotSlots from bot-engine to pick their day plan.
   */
  private async executeBotSimDay(): Promise<void> {
    if (!this.state) return
    if (this.state.game.phase.type !== 'sim_day') return

    const phase = this.state.game.phase
    const submitted = new Set(phase.submittedSessionIds)

    for (const [sid, session] of Object.entries(this.state.sessions)) {
      if (!session.isBot || !session.botPersonality) continue
      if (submitted.has(sid)) continue

      const ps = this.state.playerSim[sid]
      if (!ps) continue

      const slots = chooseBotSlots(ps, this.state.game, session.botPersonality, Math.random())
      this.state.playerSim[sid] = { ...ps, scheduledSlots: slots }
      submitted.add(sid)
    }

    this.state.game = {
      ...this.state.game,
      phase: { ...phase, submittedSessionIds: Array.from(submitted) },
    }

    await this.persist()
    this.broadcastStateSecure()

    // Check if all players (human + bot) have now submitted
    const activeSessionIds = Object.keys(this.state.sessions)
    if (activeSessionIds.length > 0 && activeSessionIds.every(id => submitted.has(id))) {
      await this.advanceFromSimDay('all_submitted')
      // After sim day resolves and transitions to auction_round, check bot turns
      await this.executeBotTurn()
    }
  }

  private async persist() {
    if (this.state) await this.room.storage.put('state', this.state)
  }
}

GameServer satisfies Party.Worker

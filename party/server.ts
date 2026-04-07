import type * as Party from 'partykit/server'
import { z } from 'zod'
import type {
  GameState, Card, Artist, RoundResult,
  PublicGameState, PublicAuctionState,
} from '../src/types/game'
import { ARTISTS } from '../src/types/game'
import {
  emptyArtistCounts,
  playCard, playSecondCard, passSecondCard, setFixedPrice, acceptFixedPrice,
  passFixedPrice, placeOpenBid, endOpenAuction, placeOnceAroundBid,
  submitSealedBid, endRound, startGame,
} from '../src/lib/engine'
import type { PlayerRecord } from '../src/types/game'

// ─── Inbound message schema (ENG-05) ──────────────────────────────────────────

const ArtistSchema = z.enum(['lite_metal', 'yoko', 'christine_p', 'karl_gitter', 'krypto'])
const AuctionTypeSchema = z.enum(['open', 'once_around', 'sealed_bid', 'fixed_price', 'double'])
const CardSchema = z.object({
  id: z.string(),
  artist: ArtistSchema,
  auctionType: AuctionTypeSchema,
})

const InboundMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('JOIN'), name: z.string().min(1).max(30).regex(/^[\x20-\x7E]+$/), isHost: z.boolean().optional() }),
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
])
type InboundMessage = z.infer<typeof InboundMessage>

// ─── Server state ─────────────────────────────────────────────────────────────

interface Session {
  sessionId: string
  name: string
  isHost: boolean
  position: number
  money: number
  paintings: { artist: Artist; round: number }[]
}

interface ServerState {
  game: GameState
  hands: Record<string, Card[]>       // sessionId → hand
  sessions: Record<string, Session>   // sessionId → session info
  lastRoundResult?: RoundResult       // persisted for reconnect recovery (ENG-09)
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

  constructor(readonly room: Party.Room) {}

  async onStart() {
    this.state = await this.room.storage.get<ServerState>('state') ?? null
  }

  async onConnect(conn: Party.Connection) {
    if (!this.state) return
    // Send public projection of game state (deck stripped, sealed bids hidden)
    conn.send(JSON.stringify({ type: 'GAME_STATE', game: derivePublicState(this.state.game) }))
    // Send private hand
    const hand = this.state.hands[conn.id] ?? []
    conn.send(JSON.stringify({ type: 'YOUR_HAND', hand }))
    // ENG-09: replay last round summary if a round resolved while we were gone
    if (this.state.lastRoundResult && this.state.game.status === 'playing') {
      conn.send(JSON.stringify({ type: 'ROUND_END', result: this.state.lastRoundResult }))
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
        }

        this.state = {
          game: initialGame,
          hands: { [sessionId]: [] },
          sessions: { [sessionId]: session },
        }
      } else {
        // Check if already in session (reconnect)
        if (this.state.sessions[sessionId]) {
          sender.send(JSON.stringify({ type: 'GAME_STATE', game: derivePublicState(this.state.game) }))
          sender.send(JSON.stringify({ type: 'YOUR_HAND', hand: this.state.hands[sessionId] ?? [] }))
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
        this.state.game = {
          ...this.state.game,
          players: [...this.state.game.players, sessionToPublicPlayer(session)],
        }
      }

      await this.persist()
      this.broadcastStateSecure()
      return
    }

    // ── START_GAME ──────────────────────────────────────────────────────────
    if (msg.type === 'START_GAME') {
      if (!this.state) return
      const session = this.state.sessions[sessionId]
      if (!session?.isHost) { sender.send(JSON.stringify({ type: 'ERROR', message: 'Only host can start' })); return }
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

      this.state = { ...this.state, game: updatedGame, hands: newHands, sessions: newSessions }
      await this.persist()
      this.broadcastStateSecure()
      this.broadcastHands()
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

        this.state.game = finalGame
        // ENG-09: persist last round result so reconnecting players can replay it
        this.state.lastRoundResult = result
        await this.persist()
        this.broadcastStateSecure()
        this.broadcastHands()
        this.room.broadcast(JSON.stringify({ type: 'ROUND_END', result }))
      } else {
        this.state.game = updatedGame
        await this.persist()
        this.broadcastStateSecure()
        sender.send(JSON.stringify({ type: 'YOUR_HAND', hand: updatedPlayer.hand }))
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
      return
    }

    // ── SET_FIXED_PRICE ─────────────────────────────────────────────────────
    if (msg.type === 'SET_FIXED_PRICE') {
      if (!this.state) return
      this.state.game = setFixedPrice(this.state.game, msg.price)
      await this.persist()
      this.broadcastStateSecure()
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
    this.state.game = updatedGame
  }

  private broadcastStateSecure() {
    if (!this.state) return
    const publicGame = derivePublicState(this.state.game)
    const payload = JSON.stringify({ type: 'GAME_STATE', game: publicGame })
    for (const conn of this.room.getConnections()) {
      conn.send(payload)
    }
  }

  private broadcastHands() {
    if (!this.state) return
    for (const conn of this.room.getConnections()) {
      const hand = this.state.hands[conn.id] ?? []
      conn.send(JSON.stringify({ type: 'YOUR_HAND', hand }))
    }
  }

  private async persist() {
    if (this.state) await this.room.storage.put('state', this.state)
  }
}

GameServer satisfies Party.Worker

import type * as Party from 'partykit/server'
import type {
  GameState, Card, Artist, RoundResult,
  PublicGameState, PublicAuctionState,
} from '../src/types/game'
import { ARTISTS } from '../src/types/game'
import {
  emptyArtistCounts,
  playCard, playSecondCard, passSecondCard, setFixedPrice, acceptFixedPrice,
  passFixedPrice, placeOpenBid, endOpenAuction, placeOnceAroundBid,
  submitSealedBid, endRound,
} from '../src/lib/engine'
import { buildDeck, shuffle, dealHands } from '../src/lib/deck'
import type { PlayerRecord } from '../src/types/game'

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
    gameId: '',
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

// ─── PartyKit Server ──────────────────────────────────────────────────────────

export default class GameServer implements Party.Server {
  private state: ServerState | null = null

  constructor(readonly room: Party.Room) {}

  async onStart() {
    this.state = await this.room.storage.get<ServerState>('state') ?? null
  }

  async onConnect(conn: Party.Connection) {
    if (!this.state) return
    // Send current public state
    conn.send(JSON.stringify({ type: 'GAME_STATE', game: this.state.game }))
    // Send private hand
    const hand = this.state.hands[conn.id] ?? []
    conn.send(JSON.stringify({ type: 'YOUR_HAND', hand }))
  }

  async onMessage(message: string, sender: Party.Connection) {
    const msg = JSON.parse(message)
    try {
      await this.handleMessage(msg, sender)
    } catch (e) {
      sender.send(JSON.stringify({ type: 'ERROR', message: String(e) }))
    }
  }

  private async handleMessage(msg: Record<string, unknown>, sender: Party.Connection) {
    const sessionId = sender.id as string

    // ── JOIN ────────────────────────────────────────────────────────────────
    if (msg.type === 'JOIN') {
      const name = msg.name as string
      const isHost = msg.isHost as boolean

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
          sender.send(JSON.stringify({ type: 'GAME_STATE', game: this.state.game }))
          sender.send(JSON.stringify({ type: 'YOUR_HAND', hand: this.state.hands[sessionId] ?? [] }))
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
      this.broadcastState()
      return
    }

    // ── START_GAME ──────────────────────────────────────────────────────────
    if (msg.type === 'START_GAME') {
      if (!this.state) return
      const session = this.state.sessions[sessionId]
      if (!session?.isHost) { sender.send(JSON.stringify({ type: 'ERROR', message: 'Only host can start' })); return }
      if (this.state.game.players.length < 2) { sender.send(JSON.stringify({ type: 'ERROR', message: 'Need at least 2 players' })); return }

      const playerCount = this.state.game.players.length
      const deck = shuffle(buildDeck())
      const { hands, remaining } = dealHands(deck, playerCount, 1)

      const sortedSessions = Object.values(this.state.sessions).sort((a, b) => a.position - b.position)
      const newSessions: Record<string, Session> = {}
      const newHands: Record<string, Card[]> = {}

      sortedSessions.forEach((sess, i) => {
        newSessions[sess.sessionId] = { ...sess, money: 100000, paintings: [] }
        newHands[sess.sessionId] = hands[i] ?? []
      })

      const updatedPlayers = sortedSessions.map(s => sessionToPublicPlayer({ ...s, money: 100000, paintings: [] }))

      this.state = {
        ...this.state,
        game: {
          ...this.state.game,
          status: 'playing',
          round: 1,
          currentPlayerIdx: 0,
          artistCounts: emptyArtistCounts(),
          roundValues: emptyArtistCounts(),
          roundHistory: [],
          deck: remaining,
          auction: null,
          players: updatedPlayers,
        },
        hands: newHands,
        sessions: newSessions,
      }

      await this.persist()
      this.broadcastState()
      this.broadcastHands()
      return
    }

    // ── PLAY_CARD ───────────────────────────────────────────────────────────
    if (msg.type === 'PLAY_CARD') {
      if (!this.state) return
      const card = msg.card as Card
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
        await this.persist()
        this.broadcastState()
        this.broadcastHands()
        this.room.broadcast(JSON.stringify({ type: 'ROUND_END', result }))
      } else {
        this.state.game = updatedGame
        await this.persist()
        this.broadcastState()
        sender.send(JSON.stringify({ type: 'YOUR_HAND', hand: updatedPlayer.hand }))
      }
      return
    }

    // ── PLAY_SECOND_CARD ────────────────────────────────────────────────────
    if (msg.type === 'PLAY_SECOND_CARD') {
      if (!this.state) return
      const card = msg.card as Card
      const playerRecord = this.getPlayerRecord(sessionId)
      if (!playerRecord) return

      const { updatedGame, updatedPlayer } = playSecondCard(this.state.game, playerRecord, card)
      this.state.game = updatedGame
      this.state.hands[sessionId] = updatedPlayer.hand

      await this.persist()
      this.broadcastState()
      sender.send(JSON.stringify({ type: 'YOUR_HAND', hand: updatedPlayer.hand }))
      return
    }

    // ── SET_FIXED_PRICE ─────────────────────────────────────────────────────
    if (msg.type === 'SET_FIXED_PRICE') {
      if (!this.state) return
      this.state.game = setFixedPrice(this.state.game, msg.price as number)
      await this.persist()
      this.broadcastState()
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
      this.broadcastState()
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
      this.broadcastState()
      return
    }

    // ── PLACE_OPEN_BID ──────────────────────────────────────────────────────
    if (msg.type === 'PLACE_OPEN_BID') {
      if (!this.state) return
      const session = this.state.sessions[sessionId]
      if (!session) return
      this.state.game = placeOpenBid(this.state.game, session.position, msg.amount as number)
      await this.persist()
      this.broadcastState()
      return
    }

    // ── END_OPEN_AUCTION ────────────────────────────────────────────────────
    if (msg.type === 'END_OPEN_AUCTION') {
      if (!this.state) return
      const allRecords = this.getAllPlayerRecords()
      const { updatedGame, updatedPlayers } = endOpenAuction(this.state.game, allRecords)
      this.applyPlayerUpdates(updatedGame, updatedPlayers)
      await this.persist()
      this.broadcastState()
      return
    }

    // ── PLACE_ONCE_AROUND_BID ───────────────────────────────────────────────
    if (msg.type === 'PLACE_ONCE_AROUND_BID') {
      if (!this.state) return
      const session = this.state.sessions[sessionId]
      if (!session) return
      const allRecords = this.getAllPlayerRecords()
      const result = placeOnceAroundBid(this.state.game, allRecords, session.position, msg.amount as number | null)
      if ('updatedPlayers' in result) {
        this.applyPlayerUpdates(result.updatedGame, result.updatedPlayers)
      } else {
        this.state.game = result.updatedGame
      }
      await this.persist()
      this.broadcastState()
      return
    }

    // ── SUBMIT_SEALED_BID ───────────────────────────────────────────────────
    if (msg.type === 'SUBMIT_SEALED_BID') {
      if (!this.state) return
      const session = this.state.sessions[sessionId]
      if (!session) return
      const allRecords = this.getAllPlayerRecords()
      const result = submitSealedBid(this.state.game, allRecords, session.position, msg.amount as number)
      if ('updatedPlayers' in result && result.updatedPlayers) {
        this.applyPlayerUpdates(result.updatedGame, result.updatedPlayers)
      } else {
        this.state.game = result.updatedGame
      }
      await this.persist()
      this.broadcastState()
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

  private broadcastState() {
    if (!this.state) return
    this.room.broadcast(JSON.stringify({ type: 'GAME_STATE', game: this.state.game }))
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

import { useEffect, useRef, useState, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import PartySocket from 'partysocket'
import type { GameState, Card, RoundResult, PlayerSimState, TimeSlot } from '../types/game'

// ─── Config ───────────────────────────────────────────────────────────────────

export const PARTYKIT_HOST = import.meta.env.DEV
  ? 'localhost:1999'
  : (import.meta.env.VITE_PARTYKIT_HOST as string ?? 'nfart-auction.laulpogan.partykit.dev')

// ─── Session ID ───────────────────────────────────────────────────────────────

export function getSessionId(): string {
  let id = localStorage.getItem('ma_session_id')
  if (!id) { id = uuid(); localStorage.setItem('ma_session_id', id) }
  return id
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGame(roomCode: string | null, playerName: string | null) {
  const [game, setGame] = useState<GameState | null>(null)
  const [hand, setHand] = useState<Card[]>([])
  const [playerSim, setPlayerSim] = useState<PlayerSimState | null>(null)
  const [roundEndResult, setRoundEndResult] = useState<RoundResult | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<PartySocket | null>(null)
  const sessionId = getSessionId()

  useEffect(() => {
    if (!roomCode || !playerName) return

    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomCode.toLowerCase(),
      id: sessionId,
    })

    socket.addEventListener('open', () => {
      setConnected(true)
      // Announce ourselves
      const isHost = sessionStorage.getItem(`host_${roomCode}`) === 'true'
      socket.send(JSON.stringify({ type: 'JOIN', name: playerName, isHost }))
    })

    socket.addEventListener('message', (e: MessageEvent) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'GAME_STATE') setGame(msg.game as GameState)
      if (msg.type === 'YOUR_HAND') setHand(msg.hand as Card[])
      if (msg.type === 'YOUR_SIM_STATE') setPlayerSim(msg.simState as PlayerSimState)
      if (msg.type === 'ROUND_END') setRoundEndResult(msg.result as RoundResult)
      if (msg.type === 'ERROR') setError(msg.message as string)
    })

    socket.addEventListener('close', () => setConnected(false))
    socket.addEventListener('error', () => setError('Connection error'))

    socketRef.current = socket
    return () => {
      socket.close()
      socketRef.current = null
    }
  }, [roomCode, playerName, sessionId])

  const send = useCallback((msg: object) => {
    socketRef.current?.send(JSON.stringify(msg))
  }, [])

  const myPlayerIdx = game?.players.findIndex(p => p.sessionId === sessionId) ?? -1
  const isMyTurn = game?.currentPlayerIdx === myPlayerIdx && game?.status === 'playing'
  const isAuctioneer = game?.auction?.auctioneerIdx === myPlayerIdx
  const myMoney = game?.players[myPlayerIdx]?.money ?? 100000

  return {
    game,
    hand,
    playerSim,
    myPlayerIdx,
    isMyTurn,
    isAuctioneer,
    myMoney,
    connected,
    error,
    roundEndResult,
    sessionId,
    setRoundEndResult,
    actions: {
      startGame:          () => send({ type: 'START_GAME' }),
      playCard:           (card: Card) => send({ type: 'PLAY_CARD', card }),
      playSecondCard:     (card: Card) => send({ type: 'PLAY_SECOND_CARD', card }),
      setFixedPrice:      (price: number) => send({ type: 'SET_FIXED_PRICE', price }),
      acceptFixedPrice:   () => send({ type: 'ACCEPT_FIXED_PRICE' }),
      passFixedPrice:     () => send({ type: 'PASS_FIXED_PRICE' }),
      placeOpenBid:       (amount: number) => send({ type: 'PLACE_OPEN_BID', amount }),
      endOpenAuction:     () => send({ type: 'END_OPEN_AUCTION' }),
      placeOnceAroundBid: (amount: number | null) => send({ type: 'PLACE_ONCE_AROUND_BID', amount }),
      submitSealedBid:    (amount: number) => send({ type: 'SUBMIT_SEALED_BID', amount }),
      submitSlots:        (slots: TimeSlot[]) => send({ type: 'SUBMIT_SLOTS', slots }),
    },
  }
}

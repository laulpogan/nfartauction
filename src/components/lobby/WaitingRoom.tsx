import { motion } from 'framer-motion'
import { useState } from 'react'
import type { GameState } from '../../types/game'
import { NeighborhoodProvider } from '../../contexts/NeighborhoodContext'
import { Button } from '../ui/Button'

interface WaitingRoomProps {
  game: GameState
  isHost: boolean
  onStartGame: () => void
}

export function WaitingRoom({ game, isHost, onStartGame }: WaitingRoomProps) {
  const [copied, setCopied] = useState(false)

  const playerCount = game.players.length
  const canStart = playerCount >= 2 && playerCount <= 5

  function copyCode() {
    navigator.clipboard.writeText(game.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <NeighborhoodProvider neighborhood="gallery">
      <div className="min-h-screen bg-paper text-ink font-label flex flex-col items-center justify-center p-4">
        <div className="relative z-10 w-full max-w-md">
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl font-black text-ink tracking-[0.18em] uppercase mb-1">
              NF<span className="text-[var(--color-accent)]">Art</span>
            </h1>
            <p className="text-ink-soft text-sm uppercase tracking-[0.18em]">Waiting for players...</p>
          </motion.div>

          {/* Room code */}
          <motion.div
            className="bg-paper border-2 border-ink rounded-2xl p-6 text-center mb-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-ink-soft text-xs font-semibold uppercase tracking-[0.18em] mb-2">Room Code</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-5xl font-black text-[var(--color-accent)] tracking-[0.18em]">{game.code}</span>
              <button
                onClick={copyCode}
                className="text-ink-soft hover:text-ink transition-colors text-sm uppercase tracking-[0.18em]"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-ink-soft text-xs mt-2 uppercase tracking-[0.18em]">Share this with friends to join</p>
          </motion.div>

          {/* Players */}
          <motion.div
            className="bg-paper border border-rule rounded-2xl p-4 mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-ink-soft text-xs font-semibold uppercase tracking-[0.18em] mb-3">
              Players ({playerCount}/5)
            </h3>
            <div className="space-y-2">
              {game.players.map((p, i) => (
                <motion.div
                  key={p.id}
                  className="flex items-center gap-3 bg-paper border border-rule rounded-xl px-3 py-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <div className="w-8 h-8 rounded-full bg-paper border border-ink flex items-center justify-center text-sm font-bold text-ink">
                    {p.displayName[0]?.toUpperCase()}
                  </div>
                  <span className="flex-1 font-semibold text-ink uppercase tracking-[0.18em]">{p.displayName}</span>
                  {p.isHost && <span className="text-[9px] border border-ink text-ink px-1 rounded uppercase tracking-[0.18em]">Host</span>}
                </motion.div>
              ))}
              {Array.from({ length: Math.max(0, 2 - playerCount) }).map((_, i) => (
                <div key={`empty-${i}`} className="flex items-center gap-3 bg-paper rounded-xl px-3 py-2 border border-dashed border-rule">
                  <div className="w-8 h-8 rounded-full bg-paper border border-rule flex items-center justify-center">
                    <span className="text-ink-soft text-xs">?</span>
                  </div>
                  <span className="text-ink-soft text-sm uppercase tracking-[0.18em]">Waiting for player...</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Start button */}
          {isHost && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <Button
                variant="gold"
                size="lg"
                className="w-full"
                onClick={onStartGame}
                disabled={!canStart}
              >
                {playerCount < 2
                  ? `Need at least 2 players (${playerCount}/2)`
                  : `Start Game with ${playerCount} Players`}
              </Button>
            </motion.div>
          )}
          {!isHost && (
            <p className="text-center text-ink-soft text-sm uppercase tracking-[0.18em]">
              Waiting for the host to start the game...
            </p>
          )}
        </div>
      </div>
    </NeighborhoodProvider>
  )
}

import { motion } from 'framer-motion'
import { useState } from 'react'
import type { GameState } from '../../types/game'
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
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl font-black text-white tracking-tighter mb-1">
            NF<span className="text-amber-400">Art</span>
          </h1>
          <p className="text-zinc-500 text-sm">Waiting for players...</p>
        </motion.div>

        {/* Room code */}
        <motion.div
          className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 text-center mb-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">Room Code</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-5xl font-black text-amber-400 tracking-widest">{game.code}</span>
            <button
              onClick={copyCode}
              className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-zinc-600 text-xs mt-2">Share this with friends to join</p>
        </motion.div>

        {/* Players */}
        <motion.div
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Players ({playerCount}/5)
          </h3>
          <div className="space-y-2">
            {game.players.map((p, i) => (
              <motion.div
                key={p.id}
                className="flex items-center gap-3 bg-zinc-800/60 rounded-xl px-3 py-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="w-8 h-8 rounded-full bg-indigo-800 flex items-center justify-center text-sm font-bold text-indigo-200">
                  {p.displayName[0]?.toUpperCase()}
                </div>
                <span className="flex-1 font-semibold text-zinc-200">{p.displayName}</span>
                {p.isHost && <span className="text-xs text-amber-400">👑 Host</span>}
              </motion.div>
            ))}
            {Array.from({ length: Math.max(0, 2 - playerCount) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 bg-zinc-800/20 rounded-xl px-3 py-2 border border-dashed border-zinc-800">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                  <span className="text-zinc-600 text-xs">?</span>
                </div>
                <span className="text-zinc-600 text-sm">Waiting for player...</span>
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
          <p className="text-center text-zinc-500 text-sm">
            Waiting for the host to start the game...
          </p>
        )}
      </div>
    </div>
  )
}

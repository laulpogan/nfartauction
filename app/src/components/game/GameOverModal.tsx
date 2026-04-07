import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import type { GameState } from '../../types/game'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

interface GameOverModalProps {
  game: GameState
  myPlayerIdx: number
  onPlayAgain: () => void
}

function formatMoney(n: number) {
  return `$${n.toLocaleString()}`
}

export function GameOverModal({ game, myPlayerIdx, onPlayAgain }: GameOverModalProps) {
  const sorted = [...game.players]
    .map((p, idx) => ({ ...p, originalIdx: idx }))
    .sort((a, b) => b.money - a.money)

  const winner = sorted[0]
  const iWon = winner?.originalIdx === myPlayerIdx

  return (
    <Modal open title="Game Over">
      <div className="space-y-4">
        {/* Winner announcement */}
        <motion.div
          className="text-center py-4"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <div className="text-5xl mb-2">{iWon ? '🏆' : '🎨'}</div>
          <h3 className="text-2xl font-bold text-white">
            {iWon ? 'You won!' : `${winner?.displayName} wins!`}
          </h3>
          <p className="text-amber-400 font-bold text-xl mt-1">{formatMoney(winner?.money ?? 0)}</p>
        </motion.div>

        {/* Final standings */}
        <div className="space-y-2">
          {sorted.map((player, rank) => {
            const isMe = player.originalIdx === myPlayerIdx
            const medals = ['🥇', '🥈', '🥉', '4th', '5th']
            return (
              <motion.div
                key={player.id}
                className={clsx(
                  'flex items-center gap-3 rounded-xl px-4 py-3',
                  rank === 0 ? 'bg-amber-950/40 border border-amber-700/50' : 'bg-zinc-800/40',
                  isMe ? 'ring-1 ring-amber-500/50' : '',
                )}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: rank * 0.1 }}
              >
                <span className="text-lg w-8 text-center">{medals[rank]}</span>
                <span className={clsx('flex-1 font-semibold', isMe ? 'text-amber-300' : 'text-zinc-200')}>
                  {player.displayName}
                  {isMe && <span className="text-xs text-zinc-500 ml-1">(you)</span>}
                </span>
                <span className={clsx(
                  'font-bold',
                  rank === 0 ? 'text-amber-400' : 'text-zinc-300',
                )}>
                  {formatMoney(player.money)}
                </span>
              </motion.div>
            )
          })}
        </div>

        <Button variant="gold" className="w-full" onClick={onPlayAgain}>
          Back to Lobby
        </Button>
      </div>
    </Modal>
  )
}

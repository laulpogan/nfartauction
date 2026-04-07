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

const RANKS = ['1ST', '2ND', '3RD', '4TH', '5TH'] as const

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
          <h3 className="text-2xl font-bold text-ink uppercase tracking-[0.18em]">
            {iWon ? 'You won' : `${winner?.displayName} wins`}
          </h3>
          <p className="text-[var(--color-accent)] font-bold text-xl mt-1">{formatMoney(winner?.money ?? 0)}</p>
        </motion.div>

        {/* Final standings */}
        <div className="space-y-2">
          {sorted.map((player, rank) => {
            const isMe = player.originalIdx === myPlayerIdx
            return (
              <motion.div
                key={player.id}
                className={clsx(
                  'flex items-center gap-3 rounded-xl px-4 py-3 bg-paper',
                  rank === 0 ? 'border border-[var(--color-accent)]' : 'border border-rule',
                  isMe ? 'ring-1 ring-[var(--color-accent)]' : '',
                )}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: rank * 0.1 }}
              >
                <span className="text-sm w-10 text-center font-bold text-ink tracking-[0.18em]">{RANKS[rank]}</span>
                <span className={clsx('flex-1 font-semibold uppercase tracking-[0.18em]', isMe ? 'text-[var(--color-accent)]' : 'text-ink')}>
                  {player.displayName}
                  {isMe && <span className="text-xs text-ink-soft ml-1 normal-case tracking-normal">(you)</span>}
                </span>
                <span className={clsx(
                  'font-bold',
                  rank === 0 ? 'text-[var(--color-accent)]' : 'text-ink',
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

import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import type { RoundResult, GameState } from '../../types/game'
import { ARTIST_NAMES, ARTIST_COLORS } from '../../types/game'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

interface RoundEndModalProps {
  result: RoundResult
  game: GameState
  onDismiss: () => void
}

function formatMoney(n: number) {
  return `$${n.toLocaleString()}`
}

export function RoundEndModal({ result, game, onDismiss }: RoundEndModalProps) {
  const isGameOver = game.status === 'game_over'

  return (
    <Modal open title={isGameOver ? 'Game Over!' : `Round ${result.round} Results`}>
      <div className="space-y-4">
        {/* Rankings */}
        <div>
          <h4 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">Artist Rankings</h4>
          <div className="space-y-1.5">
            {result.rankings.map((r, i) => {
              const colors = ARTIST_COLORS[r.artist]
              const medal = ['🥇', '🥈', '🥉', '', ''][i]
              return (
                <motion.div
                  key={r.artist}
                  className={clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2',
                    i < 3 ? colors.bg : 'bg-zinc-800/40',
                  )}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <span className="w-6 text-center">{medal}</span>
                  <span className={clsx('flex-1 font-semibold text-sm', i < 3 ? colors.text : 'text-zinc-500')}>
                    {ARTIST_NAMES[r.artist]}
                  </span>
                  <span className="text-zinc-400 text-sm">{r.count} paintings</span>
                  {r.value > 0 ? (
                    <span className={clsx('font-bold text-sm', colors.text)}>+{formatMoney(r.value)}</span>
                  ) : (
                    <span className="text-zinc-600 text-sm">$0</span>
                  )}
                  {r.cumulativeValue > 0 && r.value > 0 && (
                    <span className="text-zinc-500 text-xs">(={formatMoney(r.cumulativeValue)})</span>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Payouts */}
        <div>
          <h4 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">Payouts</h4>
          <div className="space-y-1.5">
            {result.payouts
              .map((payout, idx) => ({ payout, player: game.players[idx] }))
              .sort((a, b) => b.payout.amount - a.payout.amount)
              .map(({ payout, player }, i) => (
                <motion.div
                  key={player?.id}
                  className="flex items-center gap-3 bg-zinc-800/40 rounded-lg px-3 py-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <span className="flex-1 text-zinc-300 text-sm font-semibold">{player?.displayName}</span>
                  <div className="text-right">
                    <span className={clsx(
                      'font-bold text-sm',
                      payout.amount > 0 ? 'text-green-400' : 'text-zinc-500',
                    )}>
                      +{formatMoney(payout.amount)}
                    </span>
                    {payout.breakdown.length > 0 && (
                      <div className="text-zinc-500 text-xs">
                        {payout.breakdown.map(b => `${b.count}×${ARTIST_NAMES[b.artist].split(' ')[0]}`).join(', ')}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
          </div>
        </div>

        <Button variant="gold" className="w-full" onClick={onDismiss}>
          {isGameOver ? 'See Final Scores' : 'Continue to Round ' + (result.round + 1)}
        </Button>
      </div>
    </Modal>
  )
}

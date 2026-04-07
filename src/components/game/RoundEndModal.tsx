import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import type { RoundResult, GameState } from '../../types/game'
import { ARTIST_NAMES } from '../../types/game'
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

const RANKS = ['1ST', '2ND', '3RD', '4TH', '5TH'] as const

export function RoundEndModal({ result, game, onDismiss }: RoundEndModalProps) {
  const isGameOver = game.status === 'game_over'

  return (
    <Modal open title={isGameOver ? 'Game Over' : `Round ${result.round} Results`}>
      <div className="space-y-4">
        {/* Rankings */}
        <div>
          <h4 className="text-ink-soft text-xs font-semibold uppercase tracking-[0.18em] mb-2">Artist Rankings</h4>
          <div className="space-y-1.5">
            {result.rankings.map((r, i) => {
              return (
                <motion.div
                  key={r.artist}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 bg-paper border border-rule"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <span className="w-10 text-center text-ink text-xs font-bold tracking-[0.18em]">{RANKS[i]}</span>
                  <span className={clsx('flex-1 font-semibold text-sm uppercase tracking-[0.18em]', i < 3 ? 'text-ink' : 'text-ink-soft')}>
                    {ARTIST_NAMES[r.artist]}
                  </span>
                  <span className="text-ink-soft text-sm">{r.count} paintings</span>
                  {r.value > 0 ? (
                    <span className="font-bold text-sm text-ink">+{formatMoney(r.value)}</span>
                  ) : (
                    <span className="text-ink-soft text-sm">$0</span>
                  )}
                  {r.cumulativeValue > 0 && r.value > 0 && (
                    <span className="text-ink-soft text-xs">(={formatMoney(r.cumulativeValue)})</span>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Payouts */}
        <div>
          <h4 className="text-ink-soft text-xs font-semibold uppercase tracking-[0.18em] mb-2">Payouts</h4>
          <div className="space-y-1.5">
            {result.payouts
              .map((payout, idx) => ({ payout, player: game.players[idx] }))
              .sort((a, b) => b.payout.amount - a.payout.amount)
              .map(({ payout, player }, i) => (
                <motion.div
                  key={player?.id}
                  className="flex items-center gap-3 bg-paper border border-rule rounded-lg px-3 py-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <span className="flex-1 text-ink text-sm font-semibold uppercase tracking-[0.18em]">{player?.displayName}</span>
                  <div className="text-right">
                    <span className={clsx(
                      'font-bold text-sm',
                      payout.amount > 0 ? 'text-ink' : 'text-ink-soft',
                    )}>
                      +{formatMoney(payout.amount)}
                    </span>
                    {payout.breakdown.length > 0 && (
                      <div className="text-ink-soft text-xs">
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

import { useState } from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { WallLabel } from '../../aesthetic/WallLabel'
import { ArtCard } from '../ArtCard'
import { Button } from '../../ui/Button'
import type { AuctionSkinProps } from './types'
import { formatMoney } from './types'

/**
 * Formal-dinner once-around skin.
 *
 * Players line a dinner table in seat order. The active player's seat is
 * scaled 1.05 with an accent border — a visible "your turn" cue for the
 * sequential bid feedback the Once Around auction requires.
 */
export function OnceAroundSkin(props: AuctionSkinProps) {
  const { game, myPlayerIdx, myMoney, onPlaceOnceAroundBid } = props
  const auction = game.auction!
  const auctioneer = game.players[auction.auctioneerIdx]
  const isMyTurn = auction.onceAroundCurrentIdx === myPlayerIdx && auction.status === 'active'
  const [bidAmount, setBidAmount] = useState('')

  const highBid = (() => {
    const bids = Object.values(auction.onceAroundBids).filter(
      (b): b is number => b !== null && b !== undefined,
    )
    return bids.length > 0 ? Math.max(...bids) : null
  })()

  return (
    <motion.div
      data-testid="skin-once-around"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="bg-paper p-6 border border-rule"
    >
      <div className="mb-4 space-y-1">
        <WallLabel size="lg">ONCE AROUND — THE DINNER</WallLabel>
        <div>
          <WallLabel size="sm">HOST: {(auctioneer?.displayName ?? '').toUpperCase()}</WallLabel>
        </div>
      </div>

      <div className="flex gap-2 mb-6 justify-center">
        {auction.cards.map(card => (
          <ArtCard key={card.id} card={card} size="md" />
        ))}
      </div>

      <div className="mb-4">
        <div className="mb-3">
          <WallLabel size="sm">
            HIGHEST BID: {highBid !== null ? formatMoney(highBid) : 'NO BIDS YET'}
          </WallLabel>
        </div>

        {/* Dinner-table seat row */}
        <div className="flex gap-2 justify-between">
          {game.players.map((p, i) => {
            const bid = auction.onceAroundBids[i]
            const isCurrent = auction.onceAroundCurrentIdx === i && auction.status === 'active'
            const tile = (
              <div
                className={clsx(
                  'flex-1 text-center p-3 bg-paper min-w-[5rem]',
                  isCurrent ? 'border-2 border-[var(--color-accent)]' : 'border border-rule',
                )}
              >
                <div>
                  <WallLabel size="sm">{p.displayName.split(' ')[0].toUpperCase()}</WallLabel>
                </div>
                <div className="mt-1">
                  <WallLabel size="sm">
                    {bid === undefined
                      ? isCurrent
                        ? 'BIDDING…'
                        : 'WAITING'
                      : bid === null
                        ? 'PASS'
                        : formatMoney(bid)}
                  </WallLabel>
                </div>
              </div>
            )
            return isCurrent ? (
              <motion.div
                key={p.id}
                animate={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                className="flex-1"
              >
                {tile}
              </motion.div>
            ) : (
              <div key={p.id} className="flex-1">
                {tile}
              </div>
            )
          })}
        </div>
      </div>

      {isMyTurn && (
        <div className="flex gap-2">
          <input
            type="number"
            value={bidAmount}
            onChange={e => setBidAmount(e.target.value)}
            placeholder="YOUR BID"
            className="flex-1 bg-paper border border-ink px-3 py-2 text-ink text-sm focus:outline-none focus:border-[var(--color-accent)]"
            min={1}
          />
          <Button
            variant="primary"
            onClick={() => {
              const amt = parseInt(bidAmount)
              if (!isNaN(amt) && amt > 0) {
                onPlaceOnceAroundBid(amt)
                setBidAmount('')
              }
            }}
            disabled={!bidAmount || parseInt(bidAmount) > myMoney}
          >
            BID
          </Button>
          <Button variant="secondary" onClick={() => onPlaceOnceAroundBid(null)}>
            PASS
          </Button>
        </div>
      )}
    </motion.div>
  )
}

import { useState } from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { WallLabel } from '../../aesthetic/WallLabel'
import { ArtCard } from '../ArtCard'
import { Button } from '../../ui/Button'
import type { AuctionSkinProps } from './types'
import { formatMoney } from './types'

/**
 * Preview-night open-auction skin.
 *
 * Aesthetic: gallery preview night. Players line the wall as small label
 * cards. The current leading bidder's card performs a subtle "raised hand"
 * y-pulse (loop). Bid input + "HAMMER DOWN — SOLD" button for the
 * auctioneer. No emoji.
 */
export function OpenAuctionSkin(props: AuctionSkinProps) {
  const { game, myPlayerIdx, isAuctioneer, myMoney, onPlaceOpenBid, onEndOpenAuction } = props
  const auction = game.auction!
  const auctioneer = game.players[auction.auctioneerIdx]
  const [bidAmount, setBidAmount] = useState('')

  return (
    <motion.div
      data-testid="skin-open"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-paper border-2 border-[var(--color-accent)] p-6"
    >
      <div className="mb-4 space-y-1">
        <WallLabel size="lg">PREVIEW NIGHT — OPEN AUCTION</WallLabel>
        <div>
          <WallLabel size="sm">AUCTIONEER: {(auctioneer?.displayName ?? '').toUpperCase()}</WallLabel>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {auction.cards.map(card => (
          <ArtCard key={card.id} card={card} size="md" />
        ))}
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <WallLabel size="sm">
            CURRENT BID: {auction.currentBid > 0 ? formatMoney(auction.currentBid) : 'NO BIDS YET'}
          </WallLabel>
          {auction.leadingBidderIdx !== null && (
            <WallLabel size="sm">
              LEADING: {(game.players[auction.leadingBidderIdx]?.displayName ?? '').toUpperCase()}
            </WallLabel>
          )}
        </div>

        {/* Player strip — small wall-label cards, leading bidder pulses */}
        <div className="flex gap-2 flex-wrap">
          {game.players.map((p, i) => {
            const isLeading = auction.leadingBidderIdx === i
            const tile = (
              <div
                className={clsx(
                  'px-3 py-2 border',
                  isLeading ? 'border-[var(--color-accent)] bg-paper' : 'border-rule bg-paper',
                )}
              >
                <WallLabel size="sm">{p.displayName.split(' ')[0].toUpperCase()}</WallLabel>
              </div>
            )
            return isLeading ? (
              <motion.div
                key={p.id}
                animate={{ y: [-2, -8, -2] }}
                transition={{ repeat: Infinity, duration: 1.6 }}
                data-testid={`raised-hand-${i}`}
              >
                {tile}
              </motion.div>
            ) : (
              <div key={p.id}>{tile}</div>
            )
          })}
        </div>
      </div>

      {auction.status === 'active' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="number"
              value={bidAmount}
              onChange={e => setBidAmount(e.target.value)}
              placeholder={`Min ${auction.currentBid + 1}`}
              className="flex-1 bg-paper border border-ink px-3 py-2 text-ink text-sm focus:outline-none focus:border-[var(--color-accent)]"
              min={auction.currentBid + 1}
            />
            <Button
              variant="primary"
              onClick={() => {
                const amt = parseInt(bidAmount)
                if (!isNaN(amt) && amt > auction.currentBid) {
                  onPlaceOpenBid(amt)
                  setBidAmount('')
                }
              }}
              disabled={
                !bidAmount ||
                parseInt(bidAmount) <= auction.currentBid ||
                parseInt(bidAmount) > myMoney ||
                myPlayerIdx === auction.auctioneerIdx
              }
            >
              PLACE BID
            </Button>
          </div>

          {isAuctioneer && (
            <Button variant="gold" className="w-full" onClick={onEndOpenAuction}>
              HAMMER DOWN — SOLD
            </Button>
          )}
        </div>
      )}

      {auction.status === 'completed' && (
        <div className="border border-rule p-3 bg-paper">
          <WallLabel size="sm">
            SOLD TO {(game.players[auction.winnerIdx ?? 0]?.displayName ?? '').toUpperCase()} FOR{' '}
            {formatMoney(auction.finalPrice ?? 0)}
          </WallLabel>
        </div>
      )}
    </motion.div>
  )
}

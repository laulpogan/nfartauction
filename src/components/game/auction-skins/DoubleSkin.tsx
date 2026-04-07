import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArtCard } from '../ArtCard'
import { Button } from '../../ui/Button'
import type { AuctionSkinProps } from './types'
import { formatMoney } from './types'
import { ARTIST_NAMES } from '../../../types/game'

/**
 * Double-auction drop-format skin.
 *
 * The ONLY skin that overrides the zine white-base palette. Dark ink
 * background with paper type to simulate a limited-edition drop / midnight
 * release. A "GOING…" label scale-pulses while the second card is awaited.
 *
 * NOTE: WallLabel hard-codes `text-ink`, so the dark-palette override can't
 * route through it. The header and in-skin labels use a raw uppercase span
 * with the same tracking/font-label classes but `text-paper`. This is
 * documented in 02-03-SUMMARY.md as a known WallLabel limitation; a future
 * plan may add a `tone="paper"` prop to WallLabel.
 */
function DarkLabel({ children, size = 'sm' }: { children: React.ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'text-base' : size === 'md' ? 'text-sm' : 'text-xs'
  return (
    <span className={`font-label uppercase tracking-[0.18em] text-paper ${sizeClass}`}>
      {children}
    </span>
  )
}

export function DoubleSkin(props: AuctionSkinProps) {
  const { game, isAuctioneer, myMoney, onPlaceOpenBid } = props
  const auction = game.auction!
  const [bidAmount, setBidAmount] = useState('')
  const secondNeeded = auction.status === 'waiting_second'

  return (
    <motion.div
      data-testid="skin-double"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-ink text-paper p-section p-10 min-h-[20rem] flex flex-col items-center justify-center"
    >
      <div className="mb-4">
        <DarkLabel size="lg">DROP — DOUBLE AUCTION</DarkLabel>
      </div>

      <div className="flex gap-3 mb-6 justify-center">
        {auction.cards.map(card => (
          <ArtCard key={card.id} card={card} size="md" />
        ))}
      </div>

      {secondNeeded ? (
        <>
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="mb-2"
            data-testid="drop-countdown"
          >
            <span className="font-label uppercase tracking-[0.18em] text-paper text-5xl">
              GOING…
            </span>
          </motion.div>
          <div className="mb-4 text-center">
            <DarkLabel>
              WAITING FOR SECOND {ARTIST_NAMES[auction.cards[0].artist].toUpperCase()} CARD
            </DarkLabel>
          </div>
        </>
      ) : (
        <div className="mb-4">
          <DarkLabel size="md">
            CURRENT BID: {auction.currentBid > 0 ? formatMoney(auction.currentBid) : 'NO BIDS YET'}
          </DarkLabel>
        </div>
      )}

      {auction.status === 'active' && isAuctioneer && (
        <div className="flex gap-2 w-full max-w-sm">
          <input
            type="number"
            value={bidAmount}
            onChange={e => setBidAmount(e.target.value)}
            placeholder={`MIN ${auction.currentBid + 1}`}
            className="flex-1 bg-ink border border-paper px-3 py-2 text-paper text-sm focus:outline-none focus:border-[var(--color-accent)] placeholder:text-paper/50"
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
              parseInt(bidAmount) > myMoney
            }
          >
            BID
          </Button>
        </div>
      )}
    </motion.div>
  )
}

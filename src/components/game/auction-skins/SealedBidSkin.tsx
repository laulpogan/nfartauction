import { useState } from 'react'
import { motion } from 'framer-motion'
import { WallLabel } from '../../aesthetic/WallLabel'
import { ArtCard } from '../ArtCard'
import { Button } from '../../ui/Button'
import type { AuctionSkinProps } from './types'

/**
 * Everyone-on-phones sealed-bid skin.
 *
 * Each player renders as a vertical phone tile in a grid. Tiles stagger in
 * on mount. When every player has submitted, the tiles flip via rotateX 180
 * simulating the reveal. The skin NEVER reads bid amounts — only
 * presence-of-submission (lock state), matching the Phase 1 public
 * projection that strips amounts.
 */
export function SealedBidSkin(props: AuctionSkinProps) {
  const { game, myPlayerIdx, myMoney, onSubmitSealedBid } = props
  const auction = game.auction!
  const [sealedBidInput, setSealedBidInput] = useState('')
  const [submittedLocal, setSubmittedLocal] = useState(false)
  const hasSubmitted = auction.sealedBids[myPlayerIdx] !== undefined || submittedLocal

  const submittedCount = Object.keys(auction.sealedBids).length
  const allSubmitted = submittedCount === game.players.length && game.players.length > 0

  const phoneVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.08 },
    }),
    reveal: {
      rotateX: 180,
      transition: { duration: 0.6 },
    },
  }

  return (
    <motion.div
      data-testid="skin-sealed-bid"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-paper p-6 border border-rule"
    >
      <div className="mb-4">
        <WallLabel size="lg">SEALED BID — EVERYONE ON PHONES</WallLabel>
        <div className="mt-1">
          <WallLabel size="sm">
            {submittedCount} OF {game.players.length} LOCKED
          </WallLabel>
        </div>
      </div>

      <div className="flex gap-2 mb-6 justify-center">
        {auction.cards.map(card => (
          <ArtCard key={card.id} card={card} size="md" />
        ))}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6">
        {game.players.map((p, i) => {
          const submitted = auction.sealedBids[i] !== undefined
          return (
            <motion.div
              key={p.id}
              data-testid={`phone-tile-${i}`}
              custom={i}
              variants={phoneVariants}
              initial="hidden"
              animate={allSubmitted ? 'reveal' : 'visible'}
              className="aspect-[9/16] border border-ink p-3 bg-paper flex flex-col items-center justify-between"
            >
              <WallLabel size="sm">{p.displayName.split(' ')[0].toUpperCase()}</WallLabel>
              <WallLabel size="sm">{submitted ? 'LOCKED' : 'TYPING'}</WallLabel>
            </motion.div>
          )
        })}
      </div>

      {!hasSubmitted && auction.status === 'active' && (
        <div className="flex gap-2">
          <input
            type="number"
            value={sealedBidInput}
            onChange={e => setSealedBidInput(e.target.value)}
            placeholder="YOUR SECRET BID"
            className="flex-1 bg-paper border border-ink px-3 py-2 text-ink text-sm focus:outline-none focus:border-[var(--color-accent)]"
            min={0}
          />
          <Button
            variant="primary"
            onClick={() => {
              const amt = parseInt(sealedBidInput)
              if (!isNaN(amt) && amt >= 0 && amt <= myMoney) {
                onSubmitSealedBid(amt)
                setSubmittedLocal(true)
                setSealedBidInput('')
              }
            }}
            disabled={!sealedBidInput || parseInt(sealedBidInput) > myMoney}
          >
            LOCK IN
          </Button>
        </div>
      )}
      {hasSubmitted && (
        <WallLabel size="sm">YOUR BID IS LOCKED — WAITING FOR OTHERS</WallLabel>
      )}
    </motion.div>
  )
}

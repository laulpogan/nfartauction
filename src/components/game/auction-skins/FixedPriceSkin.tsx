import { useState } from 'react'
import { motion } from 'framer-motion'
import { WallLabel } from '../../aesthetic/WallLabel'
import { ArtCard } from '../ArtCard'
import { Button } from '../../ui/Button'
import type { AuctionSkinProps } from './types'
import { formatMoney } from './types'

/**
 * Price-tag-on-white-wall fixed-price skin.
 *
 * A gallery assistant stands by. When the auctioneer sets a price, a tag
 * swings in with a sprung -15° → 0° rotation. The current offered-to
 * player gets Buy / Pass buttons. Whitespace is load-bearing — the tag is
 * centered with the cards, nothing else on the wall.
 */
export function FixedPriceSkin(props: AuctionSkinProps) {
  const {
    game,
    myPlayerIdx,
    isAuctioneer,
    myMoney,
    onSetFixedPrice,
    onAcceptFixedPrice,
    onPassFixedPrice,
  } = props
  const auction = game.auction!
  const auctioneer = game.players[auction.auctioneerIdx]
  const [fixedPriceInput, setFixedPriceInput] = useState('')

  const isMyTurnToBuy =
    auction.status === 'active' && auction.onceAroundCurrentIdx === myPlayerIdx
  const offeredTo = game.players[auction.onceAroundCurrentIdx]

  return (
    <motion.div
      data-testid="skin-fixed-price"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-paper p-10 min-h-[24rem] flex flex-col items-center justify-center"
    >
      <div className="mb-6">
        <WallLabel size="sm">FIXED PRICE — GALLERY ASSISTANT PRESENT</WallLabel>
      </div>

      <div className="flex gap-2 mb-8 justify-center">
        {auction.cards.map(card => (
          <ArtCard key={card.id} card={card} size="lg" />
        ))}
      </div>

      {auction.status === 'set_price' && (
        <>
          {isAuctioneer ? (
            <div className="w-full max-w-sm space-y-2">
              <WallLabel size="sm">SET YOUR ASKING PRICE</WallLabel>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={fixedPriceInput}
                  onChange={e => setFixedPriceInput(e.target.value)}
                  placeholder="e.g. 15000"
                  className="flex-1 bg-paper border border-ink px-3 py-2 text-ink text-sm focus:outline-none focus:border-[var(--color-accent)]"
                  min={0}
                />
                <Button
                  variant="gold"
                  onClick={() => {
                    const p = parseInt(fixedPriceInput)
                    if (!isNaN(p) && p >= 0) {
                      onSetFixedPrice(p)
                      setFixedPriceInput('')
                    }
                  }}
                  disabled={!fixedPriceInput}
                >
                  SET PRICE
                </Button>
              </div>
            </div>
          ) : (
            <WallLabel size="sm">
              WAITING FOR {(auctioneer?.displayName ?? '').toUpperCase()} TO SET PRICE
            </WallLabel>
          )}
        </>
      )}

      {auction.status === 'active' && auction.fixedPrice !== null && (
        <>
          <motion.div
            initial={{ rotate: -15, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            className="border-2 border-ink p-4 mt-2 inline-block bg-paper"
            data-testid="price-tag"
          >
            <WallLabel size="lg">{formatMoney(auction.fixedPrice)}</WallLabel>
          </motion.div>

          <div className="mt-4 text-center space-y-1">
            <WallLabel size="sm">GALLERY ASSISTANT: {(auctioneer?.displayName ?? '').toUpperCase()}</WallLabel>
            <div>
              <WallLabel size="sm">
                OFFERED TO: {(offeredTo?.displayName ?? '').toUpperCase()}
              </WallLabel>
            </div>
          </div>

          {isMyTurnToBuy && (
            <div className="flex gap-2 mt-6">
              <Button
                variant="gold"
                onClick={onAcceptFixedPrice}
                disabled={myMoney < auction.fixedPrice}
              >
                BUY FOR {formatMoney(auction.fixedPrice)}
              </Button>
              <Button variant="secondary" onClick={onPassFixedPrice}>
                PASS
              </Button>
            </div>
          )}
          {isMyTurnToBuy && myMoney < auction.fixedPrice && (
            <div className="mt-2">
              <WallLabel size="sm">NOT ENOUGH MONEY</WallLabel>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}

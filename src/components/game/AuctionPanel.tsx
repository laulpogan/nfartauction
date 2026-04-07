import { useState } from 'react'
import { clsx } from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'
import type { GameState } from '../../types/game'
import { ARTIST_NAMES, ARTIST_COLORS, AUCTION_TYPE_NAMES, AUCTION_TYPE_ICONS } from '../../types/game'
import { ArtCard } from './ArtCard'
import { Button } from '../ui/Button'

interface AuctionPanelProps {
  game: GameState
  myPlayerIdx: number
  isAuctioneer: boolean
  onSetFixedPrice: (price: number) => void
  onAcceptFixedPrice: () => void
  onPassFixedPrice: () => void
  onPlaceOpenBid: (amount: number) => void
  onEndOpenAuction: () => void
  onPlaceOnceAroundBid: (amount: number | null) => void
  onSubmitSealedBid: (amount: number) => void
  myMoney: number
}

function formatMoney(n: number) {
  return `$${n.toLocaleString()}`
}

export function AuctionPanel({
  game, myPlayerIdx, isAuctioneer,
  onSetFixedPrice, onAcceptFixedPrice, onPassFixedPrice,
  onPlaceOpenBid, onEndOpenAuction,
  onPlaceOnceAroundBid, onSubmitSealedBid,
  myMoney,
}: AuctionPanelProps) {
  const { auction } = game
  const [bidAmount, setBidAmount] = useState('')
  const [fixedPriceInput, setFixedPriceInput] = useState('')
  const [sealedBidInput, setSealedBidInput] = useState('')
  const [sealedBidSubmitted, setSealedBidSubmitted] = useState(false)

  if (!auction) return null

  const auctioneer = game.players[auction.auctioneerIdx]
  const colors = ARTIST_COLORS[auction.cards[0]?.artist]
  const hasSubmittedSealed = auction.sealedBids[myPlayerIdx] !== undefined

  const isOnceAroundMyTurn =
    auction.onceAroundCurrentIdx === myPlayerIdx &&
    auction.auctionType === 'once_around'

  const fixedPriceMyTurn =
    auction.auctionType === 'fixed_price' &&
    auction.status === 'active' &&
    auction.onceAroundCurrentIdx === myPlayerIdx

  return (
    <AnimatePresence>
      <motion.div
        key={auction.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={clsx(
          'rounded-2xl border-2 p-4',
          colors?.border ?? 'border-zinc-700',
          'bg-zinc-900/90 backdrop-blur',
        )}
      >
        {/* Auction header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{AUCTION_TYPE_ICONS[auction.auctionType]}</span>
              <div>
                <div className="text-white font-bold">{AUCTION_TYPE_NAMES[auction.auctionType]} Auction</div>
                <div className="text-xs text-zinc-400">
                  Auctioneer: <span className="text-zinc-200 font-semibold">{auctioneer?.displayName}</span>
                </div>
              </div>
            </div>
          </div>
          {auction.status === 'waiting_second' && (
            <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-1 rounded-full">
              Waiting for 2nd card
            </span>
          )}
        </div>

        {/* Cards being auctioned */}
        <div className="flex gap-2 mb-4">
          {auction.cards.map(card => (
            <ArtCard key={card.id} card={card} size="md" />
          ))}
        </div>

        {/* Status: waiting for second card (double auction) */}
        {auction.status === 'waiting_second' && (
          <div className="bg-amber-950/40 border border-amber-800/40 rounded-xl p-3">
            <p className="text-amber-300 text-sm">
              Double auction! Play a second <strong>{ARTIST_NAMES[auction.cards[0].artist]}</strong> card from your hand to complete this lot.
            </p>
          </div>
        )}

        {/* Set fixed price */}
        {auction.status === 'set_price' && isAuctioneer && (
          <div className="space-y-2">
            <p className="text-zinc-300 text-sm">Set your asking price:</p>
            <div className="flex gap-2">
              <input
                type="number"
                value={fixedPriceInput}
                onChange={e => setFixedPriceInput(e.target.value)}
                placeholder="e.g. 15000"
                className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                min={0}
              />
              <Button
                variant="gold"
                onClick={() => {
                  const p = parseInt(fixedPriceInput)
                  if (!isNaN(p) && p >= 0) { onSetFixedPrice(p); setFixedPriceInput('') }
                }}
                disabled={!fixedPriceInput}
              >
                Set Price
              </Button>
            </div>
          </div>
        )}

        {/* Fixed price — offer to players */}
        {auction.auctionType === 'fixed_price' && auction.status === 'active' && auction.fixedPrice !== null && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 text-sm">Asking price:</span>
              <span className="text-white font-bold text-lg">{formatMoney(auction.fixedPrice)}</span>
            </div>
            <div className="text-xs text-zinc-500">
              {game.players[auction.onceAroundCurrentIdx]?.displayName}'s turn
            </div>
            {fixedPriceMyTurn && (
              <div className="flex gap-2">
                <Button
                  variant="gold"
                  onClick={onAcceptFixedPrice}
                  disabled={myMoney < (auction.fixedPrice ?? 0)}
                >
                  Buy for {formatMoney(auction.fixedPrice)}
                </Button>
                <Button variant="secondary" onClick={onPassFixedPrice}>Pass</Button>
              </div>
            )}
            {fixedPriceMyTurn && myMoney < (auction.fixedPrice ?? 0) && (
              <p className="text-red-400 text-xs">Not enough money</p>
            )}
          </div>
        )}

        {/* Open auction */}
        {auction.auctionType === 'open' && auction.status === 'active' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-zinc-400 text-sm">Current bid: </span>
                <span className="text-white font-bold text-xl">
                  {auction.currentBid > 0 ? formatMoney(auction.currentBid) : 'No bids yet'}
                </span>
              </div>
              {auction.leadingBidderIdx !== null && (
                <span className="text-sm text-zinc-400">
                  Leading: <span className="text-green-400 font-semibold">{game.players[auction.leadingBidderIdx]?.displayName}</span>
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                value={bidAmount}
                onChange={e => setBidAmount(e.target.value)}
                placeholder={`Min ${auction.currentBid + 1}`}
                className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                min={auction.currentBid + 1}
              />
              <Button
                variant="primary"
                onClick={() => {
                  const amt = parseInt(bidAmount)
                  if (!isNaN(amt) && amt > auction.currentBid) { onPlaceOpenBid(amt); setBidAmount('') }
                }}
                disabled={!bidAmount || parseInt(bidAmount) <= auction.currentBid || parseInt(bidAmount) > myMoney}
              >
                Bid
              </Button>
            </div>

            {isAuctioneer && (
              <Button
                variant="gold"
                className="w-full"
                onClick={onEndOpenAuction}
              >
                🔨 Hammer Down — Sold!
              </Button>
            )}
          </div>
        )}

        {/* Once around */}
        {auction.auctionType === 'once_around' && auction.status === 'active' && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-sm">Highest bid:</span>
                <span className="text-white font-bold">
                  {Object.values(auction.onceAroundBids).filter(b => b !== null).length > 0
                    ? formatMoney(Math.max(...(Object.values(auction.onceAroundBids).filter(b => b !== null) as number[])))
                    : 'No bids yet'}
                </span>
              </div>
              {/* Bid status per player */}
              <div className="flex gap-1.5">
                {game.players.map((p, i) => {
                  const bid = auction.onceAroundBids[i]
                  const isCurrent = auction.onceAroundCurrentIdx === i
                  return (
                    <div key={p.id} className={clsx(
                      'flex-1 rounded-lg py-1 px-1 text-center text-xs',
                      isCurrent ? 'bg-indigo-800/60 border border-indigo-600' : 'bg-zinc-800',
                    )}>
                      <div className={clsx('font-semibold truncate', i === myPlayerIdx ? 'text-amber-300' : 'text-zinc-300')}>
                        {p.displayName.split(' ')[0]}
                      </div>
                      <div className="text-zinc-500">
                        {bid === undefined
                          ? isCurrent ? '...' : '—'
                          : bid === null ? 'Pass'
                          : formatMoney(bid)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {isOnceAroundMyTurn && (
              <div className="flex gap-2">
                <input
                  type="number"
                  value={bidAmount}
                  onChange={e => setBidAmount(e.target.value)}
                  placeholder="Your bid"
                  className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  min={1}
                />
                <Button
                  variant="primary"
                  onClick={() => {
                    const amt = parseInt(bidAmount)
                    if (!isNaN(amt) && amt > 0) { onPlaceOnceAroundBid(amt); setBidAmount('') }
                  }}
                  disabled={!bidAmount || parseInt(bidAmount) > myMoney}
                >
                  Bid
                </Button>
                <Button variant="secondary" onClick={() => onPlaceOnceAroundBid(null)}>Pass</Button>
              </div>
            )}
            {!isOnceAroundMyTurn && auction.onceAroundBids[myPlayerIdx] === undefined && (
              <p className="text-zinc-500 text-sm">Waiting for {game.players[auction.onceAroundCurrentIdx]?.displayName}...</p>
            )}
          </div>
        )}

        {/* Sealed bid */}
        {auction.auctionType === 'sealed_bid' && auction.status === 'active' && (
          <div className="space-y-3">
            <p className="text-zinc-300 text-sm">
              Submit your sealed bid — highest wins. {Object.keys(auction.sealedBids).length}/{game.players.length} submitted.
            </p>
            {/* Show who has / hasn't submitted (not amounts) */}
            <div className="flex gap-1.5">
              {game.players.map((p, i) => {
                const submitted = auction.sealedBids[i] !== undefined
                return (
                  <div key={p.id} className={clsx(
                    'flex-1 rounded-lg py-1 px-1 text-center text-xs',
                    submitted ? 'bg-green-900/40 border border-green-700/50' : 'bg-zinc-800',
                  )}>
                    <div className={clsx('font-semibold truncate', i === myPlayerIdx ? 'text-amber-300' : 'text-zinc-300')}>
                      {p.displayName.split(' ')[0]}
                    </div>
                    <div className={submitted ? 'text-green-400' : 'text-zinc-600'}>
                      {submitted ? '✓' : '...'}
                    </div>
                  </div>
                )
              })}
            </div>

            {!hasSubmittedSealed && !sealedBidSubmitted && (
              <div className="flex gap-2">
                <input
                  type="number"
                  value={sealedBidInput}
                  onChange={e => setSealedBidInput(e.target.value)}
                  placeholder="Your secret bid"
                  className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  min={0}
                />
                <Button
                  variant="primary"
                  onClick={() => {
                    const amt = parseInt(sealedBidInput)
                    if (!isNaN(amt) && amt >= 0) {
                      onSubmitSealedBid(amt)
                      setSealedBidSubmitted(true)
                      setSealedBidInput('')
                    }
                  }}
                  disabled={!sealedBidInput}
                >
                  Lock In
                </Button>
              </div>
            )}
            {(hasSubmittedSealed || sealedBidSubmitted) && (
              <p className="text-green-400 text-sm">Bid submitted — waiting for others...</p>
            )}
          </div>
        )}

        {/* Completed */}
        {auction.status === 'completed' && (
          <div className="bg-green-950/40 border border-green-800/40 rounded-xl p-3">
            <p className="text-green-300 text-sm font-semibold">
              Sold to {game.players[auction.winnerIdx ?? 0]?.displayName} for {formatMoney(auction.finalPrice ?? 0)}
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

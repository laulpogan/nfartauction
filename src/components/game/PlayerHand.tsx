import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Card, GameState } from '../../types/game'
import { ARTIST_NAMES } from '../../types/game'
import { ArtCard } from './ArtCard'
import { Button } from '../ui/Button'

interface PlayerHandProps {
  hand: Card[]
  game: GameState
  isMyTurn: boolean
  myPlayerIdx: number
  onPlayCard: (card: Card) => void
  onPlaySecondCard: (card: Card) => void
}

export function PlayerHand({ hand, game, isMyTurn, myPlayerIdx, onPlayCard, onPlaySecondCard }: PlayerHandProps) {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const { auction } = game

  const waitingForSecond = auction?.status === 'waiting_second'
  const isMyAuction = auction?.auctioneerIdx === myPlayerIdx

  // In double auction waiting phase: anyone can complete with matching artist
  const secondCardArtist = waitingForSecond ? auction?.cards[0]?.artist : null

  const canPlayCard = isMyTurn && !auction
  const canPlaySecond = waitingForSecond && selectedCard && secondCardArtist && selectedCard.artist === secondCardArtist && selectedCard.auctionType !== 'double'

  function handleCardClick(card: Card) {
    if (!canPlayCard && !waitingForSecond) return

    if (waitingForSecond) {
      if (card.artist === secondCardArtist && card.auctionType !== 'double') {
        setSelectedCard(prev => prev?.id === card.id ? null : card)
      }
      return
    }

    setSelectedCard(prev => prev?.id === card.id ? null : card)
  }

  function handlePlay() {
    if (!selectedCard) return
    if (waitingForSecond) {
      onPlaySecondCard(selectedCard)
    } else {
      onPlayCard(selectedCard)
    }
    setSelectedCard(null)
  }

  return (
    <div className="bg-paper border border-rule rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-ink-soft text-xs font-semibold uppercase tracking-[0.18em]">
          Your Hand ({hand.length} cards)
        </h3>
        {waitingForSecond && !isMyAuction && (
          <span className="text-[var(--color-accent)] text-xs bg-paper border border-[var(--color-accent)] px-2 py-0.5 rounded-full uppercase tracking-[0.18em]">
            Complete double? Play a {ARTIST_NAMES[secondCardArtist!]}
          </span>
        )}
        {waitingForSecond && isMyAuction && (
          <span className="text-[var(--color-accent)] text-xs bg-paper border border-[var(--color-accent)] px-2 py-0.5 rounded-full uppercase tracking-[0.18em]">
            Play your 2nd {ARTIST_NAMES[secondCardArtist!]} card
          </span>
        )}
        {!waitingForSecond && isMyTurn && !auction && (
          <span className="text-ink text-xs bg-paper border border-ink px-2 py-0.5 rounded-full uppercase tracking-[0.18em]">
            Your turn — play a card
          </span>
        )}
      </div>

      {/* Card grid */}
      <div className="flex flex-wrap gap-2 min-h-16">
        <AnimatePresence>
          {hand.map(card => {
            const isSelected = selectedCard?.id === card.id
            const isPlayable = canPlayCard || (waitingForSecond && card.artist === secondCardArtist && card.auctionType !== 'double')
            const isDisabled = waitingForSecond
              ? card.artist !== secondCardArtist || card.auctionType === 'double'
              : !isMyTurn || !!auction

            return (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, y: -20 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <ArtCard
                  card={card}
                  size="md"
                  selected={isSelected}
                  disabled={isDisabled}
                  onClick={isPlayable ? () => handleCardClick(card) : undefined}
                />
              </motion.div>
            )
          })}
        </AnimatePresence>
        {hand.length === 0 && (
          <p className="text-ink-soft text-sm self-center uppercase tracking-[0.18em]">No cards in hand</p>
        )}
      </div>

      {/* Action buttons */}
      {selectedCard && (
        <motion.div
          className="mt-3 flex items-center gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex-1">
            <p className="text-ink text-sm uppercase tracking-[0.18em]">
              {waitingForSecond
                ? `Complete double with ${ARTIST_NAMES[selectedCard.artist]}`
                : `Auction ${ARTIST_NAMES[selectedCard.artist]}`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSelectedCard(null)}>Cancel</Button>
          <Button
            variant={waitingForSecond && canPlaySecond ? 'gold' : 'primary'}
            size="sm"
            onClick={handlePlay}
            disabled={waitingForSecond ? !canPlaySecond : false}
          >
            {waitingForSecond ? 'Play 2nd Card' : 'Start Auction'}
          </Button>
        </motion.div>
      )}

      {!isMyTurn && !waitingForSecond && (
        <p className="text-ink-soft text-xs mt-2 uppercase tracking-[0.18em]">
          Waiting for {game.players[game.currentPlayerIdx]?.displayName}...
        </p>
      )}
    </div>
  )
}

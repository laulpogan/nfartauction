import { clsx } from 'clsx'
import type { GameState, Card, RoundResult } from '../../types/game'
import { ArtistTracker } from './ArtistTracker'
import { PlayerList } from './PlayerList'
import { AuctionPanel } from './AuctionPanel'
import { PlayerHand } from './PlayerHand'
import { RoundEndModal } from './RoundEndModal'
import { GameOverModal } from './GameOverModal'
import { NeighborhoodProvider } from '../../contexts/NeighborhoodContext'
import { useNavigate } from 'react-router-dom'

interface GameBoardProps {
  game: GameState
  hand: Card[]
  myPlayerIdx: number
  isMyTurn: boolean
  isAuctioneer: boolean
  myMoney: number
  roundEndResult: RoundResult | null
  onDismissRoundEnd: () => void
  actions: {
    playCard: (card: Card) => void
    playSecondCard: (card: Card) => void
    setFixedPrice: (price: number) => void
    acceptFixedPrice: () => void
    passFixedPrice: () => void
    placeOpenBid: (amount: number) => void
    endOpenAuction: () => void
    placeOnceAroundBid: (amount: number | null) => void
    submitSealedBid: (amount: number) => void
  }
}

export function GameBoard({
  game, hand, myPlayerIdx, isMyTurn, isAuctioneer, myMoney,
  roundEndResult, onDismissRoundEnd, actions,
}: GameBoardProps) {
  const navigate = useNavigate()

  return (
    <NeighborhoodProvider neighborhood="gallery">
      <div className="min-h-screen bg-paper text-ink font-label">
        {/* Header */}
        <div className="border-b border-rule px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black text-[var(--color-accent)] tracking-[0.18em]">NFArt</span>
            <span className="text-ink-soft">|</span>
            <span className="text-ink-soft text-sm">
              Round <span className="text-ink font-bold">{game.round}</span>/4
            </span>
            <span className="text-ink-soft">|</span>
            <span className={clsx(
              'text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-[0.18em]',
              isMyTurn && !game.auction ? 'bg-paper border border-ink text-ink' :
              game.auction ? 'bg-paper border border-[var(--color-accent)] text-[var(--color-accent)]' :
              'bg-paper border border-rule text-ink-soft',
            )}>
              {isMyTurn && !game.auction ? 'Your turn' :
               game.auction ? 'Auction in progress' :
               `${game.players[game.currentPlayerIdx]?.displayName}'s turn`}
            </span>
          </div>
          <div className="text-[var(--color-accent)] font-bold">${myMoney.toLocaleString()}</div>
        </div>

        {/* Main layout */}
        <div className="flex h-[calc(100vh-57px)]">
          {/* Left sidebar */}
          <div className="w-64 flex-shrink-0 border-r border-rule p-3 overflow-y-auto space-y-3 bg-paper">
            <PlayerList game={game} myPlayerIdx={myPlayerIdx} />
            <ArtistTracker game={game} />
          </div>

          {/* Main area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-paper">
            <div className="flex-1 overflow-y-auto p-4">
              {game.auction ? (
                <AuctionPanel
                  game={game}
                  myPlayerIdx={myPlayerIdx}
                  isAuctioneer={isAuctioneer}
                  onSetFixedPrice={actions.setFixedPrice}
                  onAcceptFixedPrice={actions.acceptFixedPrice}
                  onPassFixedPrice={actions.passFixedPrice}
                  onPlaceOpenBid={actions.placeOpenBid}
                  onEndOpenAuction={actions.endOpenAuction}
                  onPlaceOnceAroundBid={actions.placeOnceAroundBid}
                  onSubmitSealedBid={actions.submitSealedBid}
                  myMoney={myMoney}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <h2 className="text-2xl font-bold text-ink mb-2 uppercase tracking-[0.18em]">
                    {isMyTurn ? 'Your turn — start an auction' : 'Waiting for auction'}
                  </h2>
                  <p className="text-ink-soft text-sm max-w-sm uppercase tracking-[0.18em]">
                    {isMyTurn
                      ? 'Select a card from your hand below and start the auction.'
                      : `${game.players[game.currentPlayerIdx]?.displayName} is choosing a card to auction.`}
                  </p>
                </div>
              )}
            </div>

            {/* Player hand */}
            <div className="border-t border-rule p-4 bg-paper">
              <PlayerHand
                hand={hand}
                game={game}
                isMyTurn={isMyTurn}
                myPlayerIdx={myPlayerIdx}
                onPlayCard={actions.playCard}
                onPlaySecondCard={actions.playSecondCard}
              />
            </div>
          </div>

          {/* Right sidebar — round history */}
          {game.roundHistory.length > 0 && (
            <div className="w-56 flex-shrink-0 border-l border-rule p-3 overflow-y-auto bg-paper">
              <h3 className="text-ink-soft text-xs font-semibold uppercase tracking-[0.18em] mb-3">History</h3>
              <div className="space-y-3">
                {game.roundHistory.map(r => (
                  <div key={r.round} className="bg-paper border border-rule rounded-xl p-2">
                    <div className="text-ink text-xs font-bold mb-1 uppercase tracking-[0.18em]">Round {r.round}</div>
                    {r.rankings.filter(x => x.value > 0).map((x, i) => (
                      <div key={x.artist} className="flex justify-between text-xs">
                        <span className="text-ink-soft">{['1ST','2ND','3RD'][i]} {x.artist.split('_')[0]}</span>
                        <span className="text-ink">${x.cumulativeValue / 1000}k</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {roundEndResult && game.status !== 'game_over' && (
          <RoundEndModal result={roundEndResult} game={game} onDismiss={onDismissRoundEnd} />
        )}
        {game.status === 'game_over' && (
          <GameOverModal game={game} myPlayerIdx={myPlayerIdx} onPlayAgain={() => navigate('/')} />
        )}
      </div>
    </NeighborhoodProvider>
  )
}

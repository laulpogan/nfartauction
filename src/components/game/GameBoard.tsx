import type { GameState, Card, RoundResult, FinalAppraisal } from '../../types/game'
import { ArtistTracker } from './ArtistTracker'
import { PlayerList } from './PlayerList'
import { AuctionPanel } from './AuctionPanel'
import { PlayerHand } from './PlayerHand'
import { RoundEndModal } from './RoundEndModal'
import { GameOverModal } from './GameOverModal'
import { NeighborhoodProvider } from '../../contexts/NeighborhoodContext'
import { WallLabel } from '../aesthetic/WallLabel'
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
  finalAppraisals?: Record<string, FinalAppraisal> | null
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
  roundEndResult, onDismissRoundEnd, finalAppraisals = null, actions,
}: GameBoardProps) {
  const navigate = useNavigate()

  return (
    <NeighborhoodProvider neighborhood="gallery">
      <div className="min-h-screen bg-paper text-ink font-label">
        {/* Header */}
        <header className="border-b border-ink px-6 py-4 flex items-baseline justify-between bg-paper">
          <WallLabel size="lg">NFART · ROUND {game.round} OF 4</WallLabel>
          <WallLabel size="sm">
            {isMyTurn && !game.auction
              ? 'YOUR TURN'
              : game.auction
              ? 'AUCTION IN PROGRESS'
              : `${(game.players[game.currentPlayerIdx]?.displayName ?? '').toUpperCase()}'S TURN`}
          </WallLabel>
          <WallLabel size="sm">{`$${myMoney.toLocaleString()}`}</WallLabel>
        </header>

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
                <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                  <WallLabel size="lg">
                    {isMyTurn ? 'YOUR TURN TO AUCTION' : 'WAITING FOR AUCTION'}
                  </WallLabel>
                  <WallLabel size="sm">
                    {isMyTurn
                      ? 'SELECT A CARD FROM YOUR HAND BELOW AND START THE AUCTION.'
                      : `${(game.players[game.currentPlayerIdx]?.displayName ?? '').toUpperCase()} IS CHOOSING A CARD TO AUCTION.`}
                  </WallLabel>
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
              <div className="mb-3">
                <WallLabel size="sm">HISTORY</WallLabel>
              </div>
              <div className="space-y-3">
                {game.roundHistory.map(r => (
                  <div key={r.round} className="bg-paper border border-rule p-2">
                    <div className="mb-1">
                      <WallLabel size="sm">ROUND {r.round}</WallLabel>
                    </div>
                    {r.rankings.filter(x => x.value > 0).map((x, i) => (
                      <div key={x.artist} className="flex justify-between text-xs font-label">
                        <span className="text-ink-soft uppercase tracking-[0.12em]">{['1ST','2ND','3RD'][i]} {x.artist.split('_')[0]}</span>
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
          <GameOverModal
            game={game}
            appraisals={finalAppraisals}
            myPlayerIdx={myPlayerIdx}
            onPlayAgain={() => navigate('/')}
          />
        )}
      </div>
    </NeighborhoodProvider>
  )
}

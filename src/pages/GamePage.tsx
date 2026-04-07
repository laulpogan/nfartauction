import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { GameBoard } from '../components/game/GameBoard'
import { WaitingRoom } from '../components/lobby/WaitingRoom'
import { SimPanel } from '../components/sim/SimPanel'
import { NeighborhoodProvider } from '../contexts/NeighborhoodContext'

export function GamePage() {
  const { code } = useParams<{ code: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const playerName = searchParams.get('name') ?? localStorage.getItem('ma_display_name') ?? 'Player'

  const {
    game, hand, myPlayerIdx, isMyTurn, isAuctioneer, myMoney, playerSim,
    roundEndResult, setRoundEndResult, finalAppraisals, connected, error, sessionId, actions,
  } = useGame(code ?? null, playerName)

  if (!connected && !game) {
    return (
      <NeighborhoodProvider neighborhood="gallery">
        <div className="min-h-screen bg-paper text-ink font-label flex items-center justify-center">
          <div className="text-center">
            <p className="text-ink-soft uppercase tracking-[0.18em]">
              Connecting to room <span className="text-ink font-bold">{code?.toUpperCase()}</span>...
            </p>
          </div>
        </div>
      </NeighborhoodProvider>
    )
  }

  if (error) {
    return (
      <NeighborhoodProvider neighborhood="gallery">
        <div className="min-h-screen bg-paper text-ink font-label flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-[var(--color-stamp)] text-lg uppercase tracking-[0.18em]">{error}</p>
            <button onClick={() => navigate('/')} className="text-ink-soft underline text-sm uppercase tracking-[0.18em]">
              Return to lobby
            </button>
          </div>
        </div>
      </NeighborhoodProvider>
    )
  }

  if (!game) return null

  const phase = game.phase

  // Defensive fallback for legacy persisted rooms without phase.
  if (!phase) {
    if (game.status === 'lobby') {
      const isHost = game.players.find(p => p.sessionId === sessionId)?.isHost ?? false
      return (
        <WaitingRoom
          game={game}
          isHost={isHost}
          onStartGame={actions.startGame}
        />
      )
    }
    return (
      <GameBoard
        game={game}
        hand={hand}
        myPlayerIdx={myPlayerIdx}
        isMyTurn={isMyTurn}
        isAuctioneer={isAuctioneer}
        myMoney={myMoney}
        roundEndResult={roundEndResult}
        onDismissRoundEnd={() => setRoundEndResult(null)}
        finalAppraisals={finalAppraisals}
        actions={actions}
      />
    )
  }

  switch (phase.type) {
    case 'lobby': {
      const isHost = game.players.find(p => p.sessionId === sessionId)?.isHost ?? false
      return (
        <WaitingRoom
          game={game}
          isHost={isHost}
          onStartGame={actions.startGame}
        />
      )
    }
    case 'sim_day':
      return (
        <SimPanel
          game={game}
          playerSim={playerSim}
          sessionId={sessionId}
          submitSlots={actions.submitSlots}
          convertNft={actions.convertNft}
          purchaseNftWhitelist={actions.purchaseNftWhitelist}
        />
      )
    case 'auction_round':
    case 'game_over':
      return (
        <GameBoard
          game={game}
          hand={hand}
          myPlayerIdx={myPlayerIdx}
          isMyTurn={isMyTurn}
          isAuctioneer={isAuctioneer}
          myMoney={myMoney}
          roundEndResult={roundEndResult}
          onDismissRoundEnd={() => setRoundEndResult(null)}
          finalAppraisals={finalAppraisals}
          actions={actions}
        />
      )
  }
}

import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { GameBoard } from '../components/game/GameBoard'
import { WaitingRoom } from '../components/lobby/WaitingRoom'

export function GamePage() {
  const { code } = useParams<{ code: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const playerName = searchParams.get('name') ?? localStorage.getItem('ma_display_name') ?? 'Player'

  const {
    game, hand, myPlayerIdx, isMyTurn, isAuctioneer, myMoney,
    roundEndResult, setRoundEndResult, connected, error, sessionId, actions,
  } = useGame(code ?? null, playerName)

  if (!connected && !game) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🎨</div>
          <p className="text-zinc-400">Connecting to room <span className="text-white font-bold">{code?.toUpperCase()}</span>...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">{error}</p>
          <button onClick={() => navigate('/')} className="text-zinc-400 underline text-sm">
            Return to lobby
          </button>
        </div>
      </div>
    )
  }

  if (!game) return null

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
      actions={actions}
    />
  )
}

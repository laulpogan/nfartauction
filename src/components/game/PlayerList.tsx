import { clsx } from 'clsx'
import type { GameState, PublicPlayer } from '../../types/game'

interface PlayerListProps {
  game: GameState
  myPlayerIdx: number
}

function formatMoney(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`
  return `$${(n / 1000).toFixed(0)}k`
}

export function PlayerList({ game, myPlayerIdx }: PlayerListProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">Players</h3>
      <div className="space-y-2">
        {game.players.map((player: PublicPlayer, idx: number) => {
          const isCurrentTurn = idx === game.currentPlayerIdx && game.status === 'playing'
          const isAuctioneer = game.auction?.auctioneerIdx === idx
          const isMe = idx === myPlayerIdx

          return (
            <div
              key={player.id}
              className={clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2 transition-all',
                isCurrentTurn ? 'bg-indigo-950/60 border border-indigo-700/50' : 'bg-zinc-800/40',
                isMe ? 'ring-1 ring-amber-500/50' : '',
              )}
            >
              {/* Turn indicator */}
              <div className={clsx(
                'w-2 h-2 rounded-full flex-shrink-0',
                isCurrentTurn ? 'bg-green-400 animate-pulse' : 'bg-zinc-700',
              )} />

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={clsx(
                    'font-semibold text-sm truncate',
                    isMe ? 'text-amber-300' : 'text-zinc-200',
                  )}>
                    {player.displayName}
                    {isMe && <span className="text-xs text-zinc-500 ml-1">(you)</span>}
                  </span>
                  {isAuctioneer && (
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-1 rounded">🔨</span>
                  )}
                  {player.isHost && (
                    <span className="text-xs text-zinc-500">👑</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-zinc-500">
                    {player.paintingCount} painting{player.paintingCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Money */}
              <div className={clsx(
                'text-sm font-bold tabular-nums flex-shrink-0',
                player.money >= 100000 ? 'text-green-400' : player.money >= 50000 ? 'text-amber-400' : 'text-red-400',
              )}>
                {formatMoney(player.money)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

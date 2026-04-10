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
    <div className="bg-paper border border-rule rounded-2xl p-4">
      <h3 className="text-ink-soft text-xs font-semibold uppercase tracking-[0.18em] mb-3">Players</h3>
      <div className="space-y-2">
        {game.players.map((player: PublicPlayer, idx: number) => {
          const isCurrentTurn = idx === game.currentPlayerIdx && game.status === 'playing'
          const isAuctioneer = game.auction?.auctioneerIdx === idx
          const isMe = idx === myPlayerIdx

          return (
            <div
              key={player.id}
              className={clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2 transition-all bg-paper',
                isCurrentTurn ? 'border border-[var(--color-accent)]' : 'border border-rule',
                isMe ? 'ring-1 ring-[var(--color-accent)]' : '',
              )}
            >
              {/* Turn indicator */}
              <div className={clsx(
                'w-2 h-2 rounded-full flex-shrink-0',
                isCurrentTurn ? 'bg-[var(--color-accent)]' : 'bg-rule',
              )} />

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={clsx(
                    'font-semibold text-sm truncate uppercase tracking-[0.18em]',
                    isMe ? 'text-[var(--color-accent)]' : 'text-ink',
                  )}>
                    {player.displayName}
                    {isMe && <span className="text-xs text-ink-soft ml-1 normal-case tracking-normal">(you)</span>}
                  </span>
                  {isAuctioneer && (
                    <span className="text-[9px] border border-[var(--color-accent)] text-[var(--color-accent)] px-1 rounded uppercase tracking-[0.18em]">Auc</span>
                  )}
                  {player.isHost && (
                    <span className="text-[9px] border border-ink text-ink px-1 rounded uppercase tracking-[0.18em]">Host</span>
                  )}
                  {player.sessionId.startsWith('bot-') && (
                    <span className="text-[9px] border border-rule text-ink-soft px-1 rounded uppercase tracking-[0.18em]">Bot</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-ink-soft">
                    {player.paintingCount} painting{player.paintingCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Money */}
              <div className="text-sm font-bold tabular-nums flex-shrink-0 text-ink">
                {formatMoney(player.money)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

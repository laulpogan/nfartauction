import { clsx } from 'clsx'
import type { GameState } from '../../types/game'
import { ARTISTS, ARTIST_NAMES, ROUND_END_THRESHOLD } from '../../types/game'

interface ArtistTrackerProps {
  game: GameState
}

export function ArtistTracker({ game }: ArtistTrackerProps) {
  return (
    <div className="bg-paper border border-rule rounded-2xl p-4">
      <h3 className="text-ink-soft text-xs font-semibold uppercase tracking-[0.18em] mb-3">
        Round {game.round} — Paintings Offered
      </h3>

      <div className="space-y-2">
        {ARTISTS.map(artist => {
          const count = game.artistCounts[artist] ?? 0
          const value = game.roundValues[artist] ?? 0
          const isEliminated = count >= ROUND_END_THRESHOLD

          return (
            <div key={artist} className="flex items-center gap-2">
              {/* Artist label */}
              <div className="text-xs font-semibold w-24 truncate text-ink uppercase tracking-[0.18em]">
                {ARTIST_NAMES[artist]}
              </div>

              {/* Painting dots */}
              <div className="flex gap-1 flex-1">
                {Array.from({ length: ROUND_END_THRESHOLD }).map((_, i) => (
                  <div
                    key={i}
                    className={clsx(
                      'h-4 flex-1 rounded-sm transition-all duration-300 border border-rule',
                      i < count
                        ? isEliminated && i === ROUND_END_THRESHOLD - 1
                          ? 'bg-[var(--color-stamp)]'
                          : 'bg-ink'
                        : 'bg-paper',
                    )}
                  />
                ))}
              </div>

              {/* Cumulative value */}
              {value > 0 && (
                <div className="text-xs font-bold w-12 text-right text-ink">
                  ${(value / 1000).toFixed(0)}k
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Round history values */}
      {game.roundHistory.length > 0 && (
        <div className="mt-4 pt-4 border-t border-rule">
          <h4 className="text-ink-soft text-xs font-semibold uppercase tracking-[0.18em] mb-2">Cumulative Values</h4>
          <div className="grid grid-cols-5 gap-1">
            {ARTISTS.map(artist => {
              const value = game.roundValues[artist] ?? 0
              return (
                <div key={artist} className="text-center">
                  <div className={clsx('text-xs font-bold', value > 0 ? 'text-ink' : 'text-ink-soft')}>
                    {value > 0 ? `$${value / 1000}k` : '—'}
                  </div>
                  <div className="text-[9px] text-ink-soft uppercase tracking-[0.18em]">{ARTIST_NAMES[artist].split(' ')[0]}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

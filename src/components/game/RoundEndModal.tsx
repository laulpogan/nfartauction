import type { RoundResult, GameState } from '../../types/game'
import { ARTIST_NAMES } from '../../types/game'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Receipt, ReceiptRow } from '../aesthetic/Receipt'
import { WallLabel } from '../aesthetic/WallLabel'

interface RoundEndModalProps {
  result: RoundResult
  game: GameState
  onDismiss: () => void
}

export function RoundEndModal({ result, game, onDismiss }: RoundEndModalProps) {
  const isGameOver = game.status === 'game_over'

  return (
    <Modal open title={`ROUND ${result.round} RESULTS`}>
      <Receipt
        header={`AUCTION RESULTS — ROUND ${result.round}`}
        subheader={isGameOver ? 'FINAL ROUND' : `OF 4`}
        stamped
      >
        <WallLabel size="sm">ARTIST RANKINGS</WallLabel>
        <div className="my-3 space-y-1">
          {result.rankings.map((r, i) => (
            <ReceiptRow
              key={r.artist}
              label={`${i + 1}. ${ARTIST_NAMES[r.artist].toUpperCase()}`}
              value={r.value > 0 ? `+$${r.value.toLocaleString()}` : '—'}
            />
          ))}
        </div>

        <div className="dotted-rule my-3" />

        <WallLabel size="sm">PAYOUTS</WallLabel>
        <div className="my-3 space-y-1">
          {result.payouts
            .map((p, idx) => ({ p, player: game.players[idx] }))
            .filter(x => x.p.amount > 0)
            .sort((a, b) => b.p.amount - a.p.amount)
            .map(({ p, player }) => (
              <ReceiptRow
                key={player?.id ?? `payout-${p.playerIdx}`}
                label={(player?.displayName ?? '').toUpperCase()}
                value={`+$${p.amount.toLocaleString()}`}
              />
            ))}
        </div>

        <div className="mt-4">
          <Button variant="gold" className="w-full" onClick={onDismiss}>
            {isGameOver ? 'SEE FINAL SCORES' : `CONTINUE TO ROUND ${result.round + 1}`}
          </Button>
        </div>
      </Receipt>
    </Modal>
  )
}

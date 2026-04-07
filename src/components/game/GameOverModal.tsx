import type { GameState } from '../../types/game'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Receipt, ReceiptRow } from '../aesthetic/Receipt'
import { WallLabel } from '../aesthetic/WallLabel'

interface GameOverModalProps {
  game: GameState
  myPlayerIdx: number
  onPlayAgain: () => void
}

export function GameOverModal({ game, myPlayerIdx, onPlayAgain }: GameOverModalProps) {
  const sorted = [...game.players]
    .map((p, idx) => ({ ...p, originalIdx: idx }))
    .sort((a, b) => b.money - a.money)
  const winner = sorted[0]

  return (
    <Modal open title="GAME OVER">
      <Receipt header="FINAL APPRAISAL" subheader="GALLERY LEDGER" stamped>
        <div className="text-center">
          <WallLabel size="lg">
            {(winner?.displayName ?? '').toUpperCase()}
          </WallLabel>
        </div>
        <div className="text-center text-xs uppercase tracking-[0.15em] text-ink-soft mb-4">
          DECLARED THE WINNER
        </div>

        <div className="dotted-rule my-3" />

        <div className="space-y-1">
          {sorted.map((player, rank) => (
            <ReceiptRow
              key={player.id}
              label={`${rank + 1}. ${player.displayName.toUpperCase()}${player.originalIdx === myPlayerIdx ? ' (YOU)' : ''}`}
              value={`$${player.money.toLocaleString()}`}
            />
          ))}
        </div>

        <div className="mt-4">
          <Button variant="gold" className="w-full" onClick={onPlayAgain}>
            BACK TO LOBBY
          </Button>
        </div>
      </Receipt>
    </Modal>
  )
}

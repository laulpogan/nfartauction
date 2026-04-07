import type { GameState, FinalAppraisal } from '../../types/game'
import { Modal } from '../ui/Modal'
import { EndStateAppraisal } from './EndStateAppraisal'

interface GameOverModalProps {
  game: GameState
  appraisals: Record<string, FinalAppraisal> | null
  myPlayerIdx: number
  onPlayAgain: () => void
}

export function GameOverModal({
  game,
  appraisals,
  myPlayerIdx,
  onPlayAgain,
}: GameOverModalProps) {
  return (
    <Modal open title="GAME OVER">
      <EndStateAppraisal
        game={game}
        appraisals={appraisals}
        myPlayerIdx={myPlayerIdx}
        onPlayAgain={onPlayAgain}
      />
    </Modal>
  )
}

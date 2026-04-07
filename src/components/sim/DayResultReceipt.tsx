import { Receipt, ReceiptRow } from '../aesthetic/Receipt'
import type { SimEvent } from '../../types/game'

export interface DayResultReceiptProps {
  events: SimEvent[] | null
}

export function DayResultReceipt({ events }: DayResultReceiptProps) {
  if (!events || events.length === 0) {
    return (
      <Receipt header="DAY SUBMITTED" subheader="WAITING FOR OTHERS" stamped>
        <div className="text-xs text-ink-soft uppercase tracking-[0.14em] text-center">
          Your plan has been sent to the server.
        </div>
      </Receipt>
    )
  }
  return (
    <Receipt header="DAY RESOLVED" stamped>
      <div className="space-y-1">
        {events.map((e, i) => (
          <ReceiptRow key={`${e.kind}-${i}`} label={e.kind} value={e.description} />
        ))}
      </div>
    </Receipt>
  )
}

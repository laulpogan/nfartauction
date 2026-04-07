import type { ReactNode } from 'react'
import { clsx } from 'clsx'

export interface AppraisalRow {
  label: string
  value: ReactNode
  emphasis?: boolean
}

export interface AppraisalFormProps {
  title: string
  formNumber?: string
  rows: AppraisalRow[]
  footer?: ReactNode
  className?: string
}

/**
 * AppraisalForm — official-document primitive for key/value stat displays.
 * Used by stat displays (Phase 3), drug inventory (Phase 4), and painting
 * collection appraisal (Phase 5).
 */
export function AppraisalForm({
  title,
  formNumber,
  rows,
  footer,
  className,
}: AppraisalFormProps) {
  return (
    <section
      className={clsx(
        'bg-paper text-ink font-label border border-rule p-4',
        className,
      )}
    >
      <header className="flex items-baseline justify-between border-b border-ink pb-2 mb-3">
        <h3 className="uppercase tracking-[0.2em] text-sm font-bold">
          {title}
        </h3>
        {formNumber && (
          <span className="uppercase tracking-[0.15em] text-xs text-ink-soft">
            {formNumber}
          </span>
        )}
      </header>

      <dl className="space-y-1">
        {rows.map((row, i) => (
          <div
            key={`${row.label}-${i}`}
            className="flex items-baseline gap-2 border-b border-dashed border-rule pb-1"
          >
            <dt className="uppercase tracking-[0.12em] text-xs text-ink-soft min-w-[8rem]">
              {row.label}
            </dt>
            <dd
              className={clsx(
                'flex-1 text-right',
                row.emphasis ? 'font-bold text-base' : 'text-sm',
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {footer && (
        <div
          data-appraisal-footer
          className="mt-3 pt-3 border-t border-ink text-xs text-ink-soft"
        >
          {footer}
        </div>
      )}
    </section>
  )
}

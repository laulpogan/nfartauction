import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'

export interface ReceiptProps {
  header?: string
  subheader?: string
  children: ReactNode
  stamped?: boolean
  className?: string
}

const RULE = '═'.repeat(28)

/**
 * Receipt — printed-receipt primitive. Wraps content in a bordered paper
 * panel with a header rule, optional subheader, optional PRINTED rubber
 * stamp, and a framer-motion mount animation.
 */
export function Receipt({
  header,
  subheader,
  children,
  stamped = false,
  className,
}: ReceiptProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className={clsx(
        'relative bg-paper text-ink font-receipt p-6 max-w-md mx-auto border border-rule receipt-print',
        className,
      )}
    >
      {stamped && (
        <span
          data-receipt-stamp
          className="absolute top-3 right-3 border-2 border-[var(--color-stamp)] text-[var(--color-stamp)] px-2 py-0.5 text-xs font-bold uppercase tracking-[0.18em] -rotate-12 opacity-70 pointer-events-none"
        >
          PRINTED
        </span>
      )}

      {header && (
        <div className="text-center">
          <div
            data-receipt-rule
            className="text-xs text-ink-soft select-none leading-none"
          >
            {RULE}
          </div>
          <div className="my-1 uppercase tracking-[0.18em] text-sm font-bold text-ink">
            {header}
          </div>
          {subheader && (
            <div className="mb-1 text-xs uppercase tracking-[0.18em] text-ink-soft">
              {subheader}
            </div>
          )}
          <div
            data-receipt-rule
            className="text-xs text-ink-soft select-none leading-none"
          >
            {RULE}
          </div>
        </div>
      )}

      <div className="mt-3">{children}</div>
    </motion.div>
  )
}

export function ReceiptRow({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span
        data-receipt-label
        className="uppercase tracking-[0.12em] text-ink-soft"
      >
        {label}
      </span>
      <span className="text-ink font-bold tabular-nums">{value}</span>
    </div>
  )
}

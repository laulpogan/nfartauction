import type { ReactNode } from 'react'
import { clsx } from 'clsx'

export interface WallLabelProps {
  title?: string
  artist?: string
  medium?: string
  year?: string | number
  dimensions?: string
  children?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASS: Record<NonNullable<WallLabelProps['size']>, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
}

/**
 * WallLabel — dry gallery wall-label typography primitive.
 *
 * Two variants:
 *  - Free-form inline: pass `children`, rendered as `<span>` with small-caps tracking.
 *  - Structured block: pass any of `{ artist, title, year, medium, dimensions }`,
 *    rendered as a `<div>` stack (artist bold tracked, title italic + year,
 *    medium + dimensions soft).
 */
export function WallLabel({
  title,
  artist,
  medium,
  year,
  dimensions,
  children,
  size = 'md',
  className,
}: WallLabelProps) {
  const sizeClass = SIZE_CLASS[size]

  if (children !== undefined) {
    return (
      <span
        className={clsx(
          'font-label uppercase tracking-[0.18em] text-ink',
          sizeClass,
          className,
        )}
      >
        {children}
      </span>
    )
  }

  return (
    <div
      className={clsx(
        'font-label text-ink leading-relaxed',
        sizeClass,
        className,
      )}
    >
      {artist && (
        <div className="uppercase tracking-[0.18em] font-bold">{artist}</div>
      )}
      {title && (
        <div className="italic">
          {title}
          {year != null && `, ${year}`}
        </div>
      )}
      {medium && <div className="text-ink-soft">{medium}</div>}
      {dimensions && <div className="text-ink-soft text-xs">{dimensions}</div>}
    </div>
  )
}

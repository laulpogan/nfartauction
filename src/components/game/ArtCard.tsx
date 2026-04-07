import { clsx } from 'clsx'
import { motion } from 'framer-motion'
import type { Card } from '../../types/game'
import { ARTIST_NAMES, AUCTION_TYPE_NAMES } from '../../types/game'

interface ArtCardProps {
  card: Card
  onClick?: () => void
  selected?: boolean
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  faceDown?: boolean
}

const ART_PATTERNS = [
  '///',
  '|||',
  '---',
  '...',
  '+++',
  '===',
  '***',
  'xxx',
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/*
 * Phase 2 zine ArtCard: paper base, ink type, black border for all cards.
 * Artist identity is encoded via typography + repeated glyph pattern, not hue.
 * The neighborhood accent appears only on the selection ring.
 */
export function ArtCard({ card, onClick, selected, disabled, size = 'md', faceDown }: ArtCardProps) {
  const pattern = ART_PATTERNS[hashString(card.id) % ART_PATTERNS.length]
  const patternLine = Array(3).fill(pattern).join(' ')

  const sizeClasses = {
    sm: 'w-16 h-24 text-xs',
    md: 'w-24 h-36 text-sm',
    lg: 'w-32 h-48 text-base',
  }

  if (faceDown) {
    return (
      <div className={clsx(
        sizeClasses[size],
        'rounded-xl bg-paper border-2 border-ink',
        'flex items-center justify-center',
      )}>
        <span className="text-ink-soft text-2xl font-bold">?</span>
      </div>
    )
  }

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || !onClick}
      whileHover={onClick && !disabled ? { scale: 1.05, y: -4 } : {}}
      whileTap={onClick && !disabled ? { scale: 0.97 } : {}}
      className={clsx(
        sizeClasses[size],
        'bg-paper rounded-xl border-2 flex flex-col overflow-hidden cursor-pointer',
        'transition-all duration-150',
        selected ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]' : 'border-ink',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
        !onClick ? 'cursor-default' : '',
      )}
    >
      {/* Header */}
      <div className="px-1.5 py-1 flex items-center justify-between border-b border-rule">
        <span className={clsx('font-bold leading-none text-ink uppercase tracking-[0.18em]', size === 'sm' ? 'text-[7px]' : 'text-[9px]')}>
          {AUCTION_TYPE_NAMES[card.auctionType]}
        </span>
        {selected && <span className="text-[var(--color-accent)] text-xs font-bold">•</span>}
      </div>

      {/* Art area */}
      <div className="flex-1 flex flex-col items-center justify-center px-1 py-1">
        <div className={clsx('font-mono opacity-40 leading-relaxed text-center text-ink', size === 'sm' ? 'text-[8px]' : 'text-[10px]')}>
          {patternLine}<br />
          {patternLine}<br />
          {patternLine}
        </div>
      </div>

      {/* Footer */}
      <div className="px-1.5 py-1 border-t border-rule">
        <div className={clsx('font-bold truncate leading-none text-ink uppercase tracking-[0.18em]', size === 'sm' ? 'text-[7px]' : 'text-[9px]')}>
          {ARTIST_NAMES[card.artist]}
        </div>
      </div>
    </motion.button>
  )
}

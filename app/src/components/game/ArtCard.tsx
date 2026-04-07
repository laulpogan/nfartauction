import { clsx } from 'clsx'
import { motion } from 'framer-motion'
import type { Card } from '../../types/game'
import { ARTIST_COLORS, ARTIST_NAMES, AUCTION_TYPE_ICONS, AUCTION_TYPE_NAMES } from '../../types/game'

interface ArtCardProps {
  card: Card
  onClick?: () => void
  selected?: boolean
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  faceDown?: boolean
}

const ART_PATTERNS = [
  '⬟⬠⬟⬠',
  '◈◉◈◉',
  '▲△▲△',
  '❋✦❋✦',
  '◐◑◐◑',
  '⌘⊛⌘⊛',
  '✶✷✶✷',
  '⬡⬢⬡⬢',
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function ArtCard({ card, onClick, selected, disabled, size = 'md', faceDown }: ArtCardProps) {
  const colors = ARTIST_COLORS[card.artist]
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
        'rounded-xl bg-zinc-800 border-2 border-zinc-600',
        'flex items-center justify-center',
        'shadow-lg',
      )}>
        <span className="text-zinc-500 text-2xl">🎨</span>
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
        `bg-gradient-to-b ${colors.card}`,
        'rounded-xl border-2 shadow-lg flex flex-col overflow-hidden cursor-pointer',
        'transition-all duration-150',
        selected ? `${colors.border} border-2 ring-2 ring-offset-2 ring-offset-zinc-900 ring-amber-400` : `border-zinc-700`,
        disabled ? 'opacity-50 cursor-not-allowed' : '',
        !onClick ? 'cursor-default' : '',
      )}
    >
      {/* Header */}
      <div className={clsx('px-1.5 py-1 flex items-center justify-between', colors.bg)}>
        <span className={clsx('font-bold leading-none', colors.text, size === 'sm' ? 'text-[9px]' : 'text-xs')}>
          {AUCTION_TYPE_ICONS[card.auctionType]}
        </span>
        {selected && <span className="text-amber-400 text-xs">✓</span>}
      </div>

      {/* Art area */}
      <div className="flex-1 flex flex-col items-center justify-center px-1 py-1">
        <div className={clsx('font-mono opacity-30 leading-relaxed text-center', colors.text, size === 'sm' ? 'text-[8px]' : 'text-[10px]')}>
          {patternLine}<br />
          {patternLine}<br />
          {patternLine}
        </div>
      </div>

      {/* Footer */}
      <div className={clsx('px-1.5 py-1', colors.bg)}>
        <div className={clsx('font-bold truncate leading-none', colors.text, size === 'sm' ? 'text-[8px]' : 'text-[9px]')}>
          {ARTIST_NAMES[card.artist]}
        </div>
        <div className="text-zinc-400 leading-none mt-0.5" style={{ fontSize: '8px' }}>
          {AUCTION_TYPE_NAMES[card.auctionType]}
        </div>
      </div>
    </motion.button>
  )
}

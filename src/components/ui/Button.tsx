import { type ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold'
  size?: 'sm' | 'md' | 'lg'
}

/*
 * Phase 2 zine palette: every variant is paper-base with ink type. "Primary"
 * and "gold" both use the neighborhood accent border — status differentiation
 * comes from weight/typography, not hue. Plan 03 may specialize per skin.
 */
export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'rounded-lg font-semibold uppercase tracking-[0.18em] transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed',
        {
          'bg-paper border-2 border-[var(--color-accent)] text-ink hover:bg-[var(--color-accent)]/10': variant === 'primary',
          'bg-paper border border-ink text-ink hover:bg-ink/5': variant === 'secondary',
          'bg-paper border-2 border-[var(--color-stamp)] text-[var(--color-stamp)] hover:bg-[var(--color-stamp)]/10': variant === 'danger',
          'bg-transparent text-ink-soft hover:text-ink': variant === 'ghost',
          'bg-[var(--color-accent)] border-2 border-[var(--color-accent)] text-paper hover:bg-paper hover:text-[var(--color-accent)]': variant === 'gold',
        },
        {
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2 text-base': size === 'md',
          'px-6 py-3 text-lg': size === 'lg',
        },
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

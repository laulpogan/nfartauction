import { type ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'rounded-lg font-semibold transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed',
        {
          'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50': variant === 'primary',
          'bg-zinc-700 hover:bg-zinc-600 text-zinc-200 border border-zinc-600': variant === 'secondary',
          'bg-red-700 hover:bg-red-600 text-white': variant === 'danger',
          'bg-transparent hover:bg-white/10 text-zinc-300': variant === 'ghost',
          'bg-amber-500 hover:bg-amber-400 text-zinc-900 shadow-lg shadow-amber-900/50': variant === 'gold',
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

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Minimal framer-motion mock so jsdom doesn't try to run animation code.
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

import { Receipt, ReceiptRow } from './Receipt'

describe('Receipt', () => {
  it('renders header and subheader', () => {
    render(
      <Receipt header="AUCTION RESULT" subheader="ROUND 2">
        <div>body</div>
      </Receipt>,
    )
    expect(screen.getByText('AUCTION RESULT')).toBeTruthy()
    expect(screen.getByText('ROUND 2')).toBeTruthy()
  })

  it('renders header wrapped between two rule lines of ═', () => {
    const { container } = render(
      <Receipt header="AUCTION RESULT">
        <div>body</div>
      </Receipt>,
    )
    const rules = container.querySelectorAll('[data-receipt-rule]')
    expect(rules.length).toBe(2)
    rules.forEach(rule => {
      expect(rule.textContent).toContain('═')
    })
  })

  it('renders children inside the body', () => {
    render(
      <Receipt header="HDR">
        <div data-testid="body-child">HELLO</div>
      </Receipt>,
    )
    expect(screen.getByTestId('body-child').textContent).toBe('HELLO')
  })

  it('renders a PRINTED stamp when stamped=true', () => {
    const { container } = render(
      <Receipt header="HDR" stamped>
        <div>body</div>
      </Receipt>,
    )
    const stamp = screen.getByText('PRINTED')
    expect(stamp).toBeTruthy()
    // className contains the stamp color token.
    expect(stamp.className).toContain('text-[var(--color-stamp)]')
    // Sanity: only one stamp.
    expect(container.querySelectorAll('[data-receipt-stamp]').length).toBe(1)
  })

  it('does NOT render a PRINTED stamp when stamped is omitted', () => {
    render(
      <Receipt header="HDR">
        <div>body</div>
      </Receipt>,
    )
    expect(screen.queryByText('PRINTED')).toBeNull()
  })

  it('ReceiptRow renders label + value', () => {
    render(<ReceiptRow label="LOT" value="#14" />)
    expect(screen.getByText('LOT')).toBeTruthy()
    expect(screen.getByText('#14')).toBeTruthy()
  })

  it('ReceiptRow label is uppercase', () => {
    const { container } = render(<ReceiptRow label="LOT" value="#14" />)
    const label = container.querySelector('[data-receipt-label]')
    expect(label).toBeTruthy()
    expect(label!.className).toContain('uppercase')
  })
})

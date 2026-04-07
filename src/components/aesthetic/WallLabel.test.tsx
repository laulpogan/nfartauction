import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WallLabel } from './WallLabel'

describe('WallLabel', () => {
  it('structured variant renders artist / title+year / medium', () => {
    render(
      <WallLabel
        artist="YOKO"
        title="Untitled (Red)"
        year={2024}
        medium="Oil on canvas"
        dimensions="24 × 36 in"
      />,
    )
    expect(screen.getByText('YOKO')).toBeTruthy()
    // Title + year are concatenated with a comma.
    expect(screen.getByText(/Untitled \(Red\), 2024/)).toBeTruthy()
    expect(screen.getByText('Oil on canvas')).toBeTruthy()
    expect(screen.getByText('24 × 36 in')).toBeTruthy()
  })

  it('free-form children variant renders inline text', () => {
    render(<WallLabel size="sm">SOLD — $42,000</WallLabel>)
    expect(screen.getByText('SOLD — $42,000')).toBeTruthy()
  })

  it('passes className through to rendered element', () => {
    const { container } = render(
      <WallLabel className="custom-xyz">INLINE</WallLabel>,
    )
    expect(container.querySelector('.custom-xyz')).toBeTruthy()
  })

  it('structured variant applies the size class (md default = text-sm)', () => {
    const { container } = render(
      <WallLabel artist="YOKO" title="Untitled" />,
    )
    expect(container.querySelector('.text-sm')).toBeTruthy()
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NeighborhoodProvider, useNeighborhood } from './NeighborhoodContext'

function Probe() {
  const { neighborhood, accentVar } = useNeighborhood()
  return (
    <span data-testid="probe" data-neighborhood={neighborhood} data-accent={accentVar}>
      probe
    </span>
  )
}

describe('NeighborhoodProvider', () => {
  it('renders a wrapping div with data-neighborhood="gallery"', () => {
    render(
      <NeighborhoodProvider neighborhood="gallery">
        <span>child</span>
      </NeighborhoodProvider>,
    )
    const root = screen.getByTestId('neighborhood-root')
    expect(root.getAttribute('data-neighborhood')).toBe('gallery')
  })

  it('sets inline --color-accent style to var(--color-gallery) for gallery', () => {
    render(
      <NeighborhoodProvider neighborhood="gallery">
        <span>child</span>
      </NeighborhoodProvider>,
    )
    const root = screen.getByTestId('neighborhood-root')
    // React serializes custom properties directly on the style attribute.
    const styleAttr = root.getAttribute('style') ?? ''
    expect(styleAttr).toContain('--color-accent')
    expect(styleAttr).toContain('var(--color-gallery)')
  })

  it('adds the neighborhood-online className only when neighborhood is "online"', () => {
    const { rerender } = render(
      <NeighborhoodProvider neighborhood="gallery">
        <span>child</span>
      </NeighborhoodProvider>,
    )
    expect(screen.getByTestId('neighborhood-root').className).toBe('')

    rerender(
      <NeighborhoodProvider neighborhood="online">
        <span>child</span>
      </NeighborhoodProvider>,
    )
    expect(screen.getByTestId('neighborhood-root').className).toContain('neighborhood-online')
  })

  it('exposes { neighborhood, accentVar } via useNeighborhood() for gallery', () => {
    render(
      <NeighborhoodProvider neighborhood="gallery">
        <Probe />
      </NeighborhoodProvider>,
    )
    const probe = screen.getByTestId('probe')
    expect(probe.getAttribute('data-neighborhood')).toBe('gallery')
    expect(probe.getAttribute('data-accent')).toBe('var(--color-gallery)')
  })

  it('sets data-neighborhood and accent var for warehouse', () => {
    render(
      <NeighborhoodProvider neighborhood="warehouse">
        <Probe />
      </NeighborhoodProvider>,
    )
    const root = screen.getByTestId('neighborhood-root')
    expect(root.getAttribute('data-neighborhood')).toBe('warehouse')
    const styleAttr = root.getAttribute('style') ?? ''
    expect(styleAttr).toContain('var(--color-warehouse)')

    const probe = screen.getByTestId('probe')
    expect(probe.getAttribute('data-accent')).toBe('var(--color-warehouse)')
  })
})

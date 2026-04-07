import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OnlineNeighborhood } from './OnlineNeighborhood'
import { useNeighborhood } from '../../contexts/NeighborhoodContext'

function Probe() {
  const { neighborhood, accentVar } = useNeighborhood()
  return (
    <div data-testid="probe" data-neighborhood={neighborhood} data-accent={accentVar}>
      probe
    </div>
  )
}

describe('OnlineNeighborhood', () => {
  it('renders a wrapping element with className neighborhood-online', () => {
    render(
      <OnlineNeighborhood>
        <div>hello</div>
      </OnlineNeighborhood>,
    )
    const root = screen.getByTestId('neighborhood-root')
    expect(root.className).toContain('neighborhood-online')
  })

  it('sets data-neighborhood="online" on the wrapping element', () => {
    render(
      <OnlineNeighborhood>
        <div>hello</div>
      </OnlineNeighborhood>,
    )
    const root = screen.getByTestId('neighborhood-root')
    expect(root.getAttribute('data-neighborhood')).toBe('online')
  })

  it('injects --color-accent: var(--color-online) as an inline style', () => {
    render(
      <OnlineNeighborhood>
        <div>hello</div>
      </OnlineNeighborhood>,
    )
    const root = screen.getByTestId('neighborhood-root')
    const styleAttr = root.getAttribute('style') ?? ''
    expect(styleAttr).toContain('--color-accent')
    expect(styleAttr).toContain('var(--color-online)')
  })

  it('renders children inside the wrapper', () => {
    render(
      <OnlineNeighborhood>
        <div>hello</div>
      </OnlineNeighborhood>,
    )
    expect(screen.getByText('hello')).toBeTruthy()
  })

  it('useNeighborhood() inside a child resolves to { neighborhood: online, accentVar: var(--color-online) }', () => {
    render(
      <OnlineNeighborhood>
        <Probe />
      </OnlineNeighborhood>,
    )
    const probe = screen.getByTestId('probe')
    expect(probe.getAttribute('data-neighborhood')).toBe('online')
    expect(probe.getAttribute('data-accent')).toBe('var(--color-online)')
  })
})

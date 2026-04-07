import type { ReactNode } from 'react'
import { NeighborhoodProvider } from '../../contexts/NeighborhoodContext'

interface OnlineNeighborhoodProps {
  children: ReactNode
}

/**
 * OnlineNeighborhood — Phase 2 wrapper that activates the "online" visual
 * aesthetic (broken-font fallback chain + accent-color flicker) for its
 * subtree.
 *
 * The visual effects are delivered entirely by Plan 01's infrastructure:
 *   - NeighborhoodProvider attaches the `neighborhood-online` class when
 *     neighborhood === 'online', which keyframes.css targets with
 *     `font-family: var(--font-broken)` and the `online-accent-flicker`
 *     animation.
 *   - tokens.css defines `--font-broken` as
 *     `'NonexistentFontXYZ123', 'Comic Sans MS', cursive` — the first
 *     name intentionally fails to load so the browser cascades to
 *     Comic Sans (or cursive) in a way that reads as "wrong".
 *   - keyframes.css wraps the flicker in a `prefers-reduced-motion: reduce`
 *     guard so accessibility settings disable it automatically.
 *
 * Phase 2 ships this wrapper with locked tests but no in-game consumer;
 * the first consumer is the Phase 5 NFT panel mount.
 */
export function OnlineNeighborhood({ children }: OnlineNeighborhoodProps) {
  return (
    <NeighborhoodProvider neighborhood="online">
      {children}
    </NeighborhoodProvider>
  )
}

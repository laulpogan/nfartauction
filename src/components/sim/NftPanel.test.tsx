import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { NftPanel } from './NftPanel'
import { createInitialPlayerSimState } from '../../lib/sim-config'
import { NFT_CONFIG } from '../../lib/sim-config'
import type { PlayerSimState, NftItem } from '../../types/game'

function makePlayerSim(overrides: Partial<PlayerSimState> = {}): PlayerSimState {
  return {
    ...createInitialPlayerSimState('s0'),
    nftWalletUnlocked: true,
    ...overrides,
  }
}

const sampleItem: NftItem = {
  id: 'nft-1',
  rarity: 'rare',
  displayLabel: 'Untitled (Glass)',
  displayMeta: 'edition of 100, 2024',
  baseValue: 10,
}

describe('NftPanel', () => {
  it('returns null when playerSim is null', () => {
    const { container } = render(
      <NftPanel
        playerSim={null}
        nftHypeCycle={50}
        onConvert={vi.fn()}
        onPurchase={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('returns null when nftWalletUnlocked is false', () => {
    const ps = makePlayerSim({ nftWalletUnlocked: false })
    const { container } = render(
      <NftPanel
        playerSim={ps}
        nftHypeCycle={50}
        onConvert={vi.fn()}
        onPurchase={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders WALLET, RATE, and HYPE rows when unlocked', () => {
    const ps = makePlayerSim({ nftWallet: 7 })
    const { container } = render(
      <NftPanel
        playerSim={ps}
        nftHypeCycle={50}
        onConvert={vi.fn()}
        onPurchase={vi.fn()}
      />,
    )
    expect(container.textContent).toContain('WALLET')
    expect(container.textContent).toContain('RATE')
    expect(container.textContent).toContain('HYPE')
    // RATE at hype=50 is 1.25
    expect(container.textContent).toContain('1.25')
    // HYPE rounded
    expect(container.textContent).toContain('50')
    // wallet value
    expect(container.textContent).toContain('7')
  })

  it('renders one data-nft-id row per heldNfts entry', () => {
    const ps = makePlayerSim({
      nftWallet: 5,
      heldNfts: [
        sampleItem,
        { ...sampleItem, id: 'nft-2', displayLabel: 'Crown (1/1)' },
      ],
    })
    const { container } = render(
      <NftPanel
        playerSim={ps}
        nftHypeCycle={50}
        onConvert={vi.fn()}
        onPurchase={vi.fn()}
      />,
    )
    const rows = container.querySelectorAll('[data-nft-id]')
    expect(rows.length).toBe(2)
    expect(rows[0].getAttribute('data-nft-id')).toBe('nft-1')
    expect(rows[1].getAttribute('data-nft-id')).toBe('nft-2')
    expect(container.textContent).toContain('Crown (1/1)')
  })

  it('shows the no-holdings row when heldNfts is empty', () => {
    const ps = makePlayerSim({ heldNfts: [] })
    const { container } = render(
      <NftPanel
        playerSim={ps}
        nftHypeCycle={50}
        onConvert={vi.fn()}
        onPurchase={vi.fn()}
      />,
    )
    expect(container.textContent).toContain('no holdings')
    expect(container.querySelectorAll('[data-nft-id]').length).toBe(0)
  })

  it('CONVERT button calls onConvert with the full nftWallet amount', () => {
    const onConvert = vi.fn()
    const ps = makePlayerSim({ nftWallet: 6 })
    const { getByRole } = render(
      <NftPanel
        playerSim={ps}
        nftHypeCycle={50}
        onConvert={onConvert}
        onPurchase={vi.fn()}
      />,
    )
    fireEvent.click(getByRole('button', { name: /CONVERT/i }))
    expect(onConvert).toHaveBeenCalledWith(6)
  })

  it('CONVERT button is disabled when nftWallet is 0', () => {
    const ps = makePlayerSim({ nftWallet: 0 })
    const { getByRole } = render(
      <NftPanel
        playerSim={ps}
        nftHypeCycle={50}
        onConvert={vi.fn()}
        onPurchase={vi.fn()}
      />,
    )
    const btn = getByRole('button', { name: /CONVERT/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('WHITELIST PURCHASE is disabled when nftWallet is below cost', () => {
    const ps = makePlayerSim({ nftWallet: NFT_CONFIG.whitelistCost - 1 })
    const { getByRole } = render(
      <NftPanel
        playerSim={ps}
        nftHypeCycle={50}
        onConvert={vi.fn()}
        onPurchase={vi.fn()}
      />,
    )
    const btn = getByRole('button', { name: /WHITELIST PURCHASE/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('WHITELIST PURCHASE calls onPurchase when enabled', () => {
    const onPurchase = vi.fn()
    const ps = makePlayerSim({ nftWallet: 5 })
    const { getByRole } = render(
      <NftPanel
        playerSim={ps}
        nftHypeCycle={50}
        onConvert={vi.fn()}
        onPurchase={onPurchase}
      />,
    )
    fireEvent.click(getByRole('button', { name: /WHITELIST PURCHASE/i }))
    expect(onPurchase).toHaveBeenCalled()
  })
})

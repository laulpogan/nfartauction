// ─── Phase 3 Plan 02: SUBMIT_SLOTS Zod schema tests ────────────────────────
//
// These tests exercise the InboundMessage discriminated union's handling of
// the new SUBMIT_SLOTS variant. They lock the Zod validation boundary — the
// trust edge between an untrusted client payload and the sim-engine.
//
// The sim-engine itself is covered in src/lib/sim-engine.test.ts; this file
// focuses exclusively on the schema gate.

import { describe, it, expect } from 'vitest'
import { InboundMessageSchema } from '../../party/server'

describe('InboundMessage SUBMIT_SLOTS validation', () => {
  const validSlot = (n: number) => ({
    id: `slot-${n}`,
    type: 'gallery_work' as const,
    neighborhood: 'gallery' as const,
  })

  it('accepts a well-formed SUBMIT_SLOTS with 4 slots', () => {
    const msg = {
      type: 'SUBMIT_SLOTS',
      slots: [0, 1, 2, 3].map(validSlot),
    }
    const result = InboundMessageSchema.safeParse(msg)
    expect(result.success).toBe(true)
  })

  it('accepts SUBMIT_SLOTS with an empty slot array (the timeout no-op path)', () => {
    const result = InboundMessageSchema.safeParse({ type: 'SUBMIT_SLOTS', slots: [] })
    expect(result.success).toBe(true)
  })

  it('accepts slots with neighborhood: null', () => {
    const result = InboundMessageSchema.safeParse({
      type: 'SUBMIT_SLOTS',
      slots: [{ id: 'slot-1', type: 'sleep', neighborhood: null }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts all 6 slot types', () => {
    const types = ['gallery_work', 'studio_visits', 'art_fair', 'opening', 'party', 'sleep']
    for (const type of types) {
      const result = InboundMessageSchema.safeParse({
        type: 'SUBMIT_SLOTS',
        slots: [{ id: 'slot-1', type, neighborhood: 'gallery' }],
      })
      expect(result.success, `slot type "${type}" should be valid`).toBe(true)
    }
  })

  it('accepts all 5 neighborhoods', () => {
    const hoods = ['gallery', 'warehouse', 'flatlands', 'hotel', 'online']
    for (const n of hoods) {
      const result = InboundMessageSchema.safeParse({
        type: 'SUBMIT_SLOTS',
        slots: [{ id: 'slot-1', type: 'party', neighborhood: n }],
      })
      expect(result.success, `neighborhood "${n}" should be valid`).toBe(true)
    }
  })

  it('rejects SUBMIT_SLOTS with 21 slots (max 20 — DoS cap T-3-10)', () => {
    const slots = Array.from({ length: 21 }, (_, i) => validSlot(i))
    const result = InboundMessageSchema.safeParse({ type: 'SUBMIT_SLOTS', slots })
    expect(result.success).toBe(false)
  })

  it('rejects SUBMIT_SLOTS with an unknown slot.type', () => {
    const result = InboundMessageSchema.safeParse({
      type: 'SUBMIT_SLOTS',
      slots: [{ id: 'slot-1', type: 'foo', neighborhood: 'gallery' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects SUBMIT_SLOTS with an unknown neighborhood', () => {
    const result = InboundMessageSchema.safeParse({
      type: 'SUBMIT_SLOTS',
      slots: [{ id: 'slot-1', type: 'party', neighborhood: 'mars' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects SUBMIT_SLOTS with empty slot.id', () => {
    const result = InboundMessageSchema.safeParse({
      type: 'SUBMIT_SLOTS',
      slots: [{ id: '', type: 'party', neighborhood: 'gallery' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects SUBMIT_SLOTS with slot.id longer than 64 chars', () => {
    const result = InboundMessageSchema.safeParse({
      type: 'SUBMIT_SLOTS',
      slots: [{ id: 'x'.repeat(65), type: 'party', neighborhood: 'gallery' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects SUBMIT_SLOTS when slots is not an array', () => {
    const result = InboundMessageSchema.safeParse({ type: 'SUBMIT_SLOTS', slots: 'nope' })
    expect(result.success).toBe(false)
  })

  it('rejects SUBMIT_SLOTS missing the slots field', () => {
    const result = InboundMessageSchema.safeParse({ type: 'SUBMIT_SLOTS' })
    expect(result.success).toBe(false)
  })
})

describe('InboundMessage regression — existing variants still validate', () => {
  it('JOIN with valid name still passes', () => {
    const result = InboundMessageSchema.safeParse({ type: 'JOIN', name: 'Paul' })
    expect(result.success).toBe(true)
  })

  it('PLACE_OPEN_BID with positive integer still passes', () => {
    const result = InboundMessageSchema.safeParse({ type: 'PLACE_OPEN_BID', amount: 1000 })
    expect(result.success).toBe(true)
  })

  it('PASS_SECOND_CARD still passes', () => {
    const result = InboundMessageSchema.safeParse({ type: 'PASS_SECOND_CARD' })
    expect(result.success).toBe(true)
  })
})

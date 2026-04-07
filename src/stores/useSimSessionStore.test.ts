import { beforeEach, describe, expect, it } from 'vitest'
import { useSimSessionStore } from './useSimSessionStore'
import type { TimeSlot } from '../types/game'

const slotA: TimeSlot = { id: 'a', type: 'gallery_work', neighborhood: 'gallery' }
const slotB: TimeSlot = { id: 'b', type: 'party', neighborhood: 'warehouse' }
const slotC: TimeSlot = { id: 'c', type: 'sleep', neighborhood: null }

describe('useSimSessionStore', () => {
  beforeEach(() => {
    useSimSessionStore.setState({ draftSlots: [], isSubmitting: false })
  })

  it('starts with empty draft and not submitting', () => {
    const s = useSimSessionStore.getState()
    expect(s.draftSlots).toEqual([])
    expect(s.isSubmitting).toBe(false)
  })

  it('addDraftSlot appends to draftSlots in order', () => {
    const { addDraftSlot } = useSimSessionStore.getState()
    addDraftSlot(slotA)
    addDraftSlot(slotB)
    expect(useSimSessionStore.getState().draftSlots).toEqual([slotA, slotB])
  })

  it('removeDraftSlot removes by id', () => {
    const { addDraftSlot, removeDraftSlot } = useSimSessionStore.getState()
    addDraftSlot(slotA)
    addDraftSlot(slotB)
    addDraftSlot(slotC)
    removeDraftSlot('b')
    expect(useSimSessionStore.getState().draftSlots).toEqual([slotA, slotC])
  })

  it('removeDraftSlot is a no-op for unknown id', () => {
    const { addDraftSlot, removeDraftSlot } = useSimSessionStore.getState()
    addDraftSlot(slotA)
    removeDraftSlot('nope')
    expect(useSimSessionStore.getState().draftSlots).toEqual([slotA])
  })

  it('clearDraft resets slots and submitting flag', () => {
    const { addDraftSlot, setSubmitting, clearDraft } =
      useSimSessionStore.getState()
    addDraftSlot(slotA)
    setSubmitting(true)
    clearDraft()
    const s = useSimSessionStore.getState()
    expect(s.draftSlots).toEqual([])
    expect(s.isSubmitting).toBe(false)
  })

  it('setSubmitting toggles isSubmitting without touching draftSlots', () => {
    const { addDraftSlot, setSubmitting } = useSimSessionStore.getState()
    addDraftSlot(slotA)
    setSubmitting(true)
    expect(useSimSessionStore.getState().isSubmitting).toBe(true)
    expect(useSimSessionStore.getState().draftSlots).toEqual([slotA])
    setSubmitting(false)
    expect(useSimSessionStore.getState().isSubmitting).toBe(false)
  })
})

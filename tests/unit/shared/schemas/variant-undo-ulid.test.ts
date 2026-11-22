// Review leftovers, "Agent tools": undoClipId and redoClipId take a ULID only.
import { describe, it, expect } from 'vitest'
import { variantSetFormatInput } from '@/shared/schemas/commands/variant'

const base = { projectId: 'P', variantId: 'V' }
const ULID = '01J00000000000000000000000'
const notUlids = ['K1', '01J0000000000000000000000', '01J0000000000000000000000I', '../x']

describe('the undo-only clip IDs are ULIDs', () => {
  it.each(notUlids)('undoClipId refuses %j', (id) => {
    const input = { ...base, format: 'image', undoClipId: id }
    expect(variantSetFormatInput.safeParse(input).success).toBe(false)
  })

  it.each(notUlids)('redoClipId refuses %j', (id) => {
    const input = { ...base, format: 'video', redoClipId: id }
    expect(variantSetFormatInput.safeParse(input).success).toBe(false)
  })

  it('both take a ULID', () => {
    const undo = { ...base, format: 'image', undoClipId: ULID }
    const redo = { ...base, format: 'video', redoClipId: ULID }
    expect(variantSetFormatInput.safeParse(undo).success).toBe(true)
    expect(variantSetFormatInput.safeParse(redo).success).toBe(true)
  })
})

// P7-10b: the base inputs of variant.setFormat and variant.update, for agent tools, hold no
// undo-only field; the full inputs are the base plus exactly those fields.
import { describe, it, expect } from 'vitest'
import {
  variantSetFormatBaseInput,
  variantSetFormatInput,
  variantUpdateBaseInput,
  variantUpdateInput,
} from '@/shared/schemas/commands/variant'

const keys = (schema: { shape: object }) => Object.keys(schema.shape).sort()
const base = { projectId: 'P', variantId: 'V' }

describe('the base inputs without the undo-only fields [P7-10b]', () => {
  it('variant.setFormat: the full input is the base plus undoClipId and redoClipId', () => {
    expect(keys(variantSetFormatBaseInput)).toEqual(['format', 'projectId', 'variantId'])
    const extra = ['redoClipId', 'undoClipId']
    expect(keys(variantSetFormatInput)).toEqual(
      [...keys(variantSetFormatBaseInput), ...extra].sort(),
    )
    const input = { ...base, format: 'image', undoClipId: 'K1' }
    expect(variantSetFormatBaseInput.safeParse(input).success).toBe(false)
  })

  it('variant.update: the full input is the base plus durationOverridden', () => {
    expect(keys(variantUpdateBaseInput)).toEqual(['durationMs', 'projectId', 'title', 'variantId'])
    expect(keys(variantUpdateInput)).toEqual(
      [...keys(variantUpdateBaseInput), 'durationOverridden'].sort(),
    )
    const flagged = { ...base, durationMs: 5000, durationOverridden: true }
    expect(variantUpdateBaseInput.safeParse(flagged).success).toBe(false)
    expect(variantUpdateInput.safeParse(flagged).success).toBe(true)
  })

  it('both inputs still need a title or a duration, and the flag goes with a duration', () => {
    for (const schema of [variantUpdateBaseInput, variantUpdateInput]) {
      expect(schema.safeParse(base).success).toBe(false)
      expect(schema.safeParse({ ...base, title: 'Spring' }).success).toBe(true)
    }
    const flagOnly = { ...base, title: 'Spring', durationOverridden: true }
    expect(variantUpdateInput.safeParse(flagOnly).success).toBe(false)
  })

  it('redoClipId goes only with a change to video', () => {
    const redo = (format: string) => ({ ...base, format, redoClipId: 'K1' })
    expect(variantSetFormatInput.safeParse(redo('video')).success).toBe(true)
    expect(variantSetFormatInput.safeParse(redo('image')).success).toBe(false)
  })
})

// P7-1 (spec/phases/phase-07-slices.md "P7-1"; spec/data-rules.md "Changing a variant's
// format"; phase-07.md "Clips and the track", Sound): variant.setFormat, variant.setSound and
// durationMs in variant.update.
import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import {
  variantSetFormatInput,
  variantSetSoundInput,
  variantUpdateInput,
} from '@/shared/schemas/commands/variant'

const P = { projectId: 'P1', variantId: 'V1' }

const GOOD: [string, z.ZodType, object][] = [
  ['setFormat to video', variantSetFormatInput, { ...P, format: 'video' }],
  ['setFormat to image', variantSetFormatInput, { ...P, format: 'image' }],
  ['setSound clips', variantSetSoundInput, { ...P, sound: 'clips' }],
  ['setSound none', variantSetSoundInput, { ...P, sound: 'none' }],
  ['setSound file with an asset', variantSetSoundInput, { ...P, sound: 'file', assetId: 'A1' }],
  ['setSound file, the stored asset', variantSetSoundInput, { ...P, sound: 'file' }],
  ['update the title', variantUpdateInput, { ...P, title: 'Summer' }],
  ['update durationMs of 500', variantUpdateInput, { ...P, durationMs: 500 }],
  ['update durationMs of a day', variantUpdateInput, { ...P, durationMs: 86_400_000 }],
  ['update both', variantUpdateInput, { ...P, title: 'Summer', durationMs: 8000 }],
]

describe('the Phase 7 variant inputs take a good value [P7-1]', () => {
  it.each(GOOD)('%s', (_name, schema, input) => {
    expect(schema.safeParse(input).success).toBe(true)
  })

  it.each(GOOD)('%s refuses an unknown key and a missing projectId', (_name, schema, input) => {
    expect(schema.safeParse({ ...input, extra: 1 }).success).toBe(false)
    expect(schema.safeParse({ ...input, projectId: undefined }).success).toBe(false)
  })
})

const REFUSED: [string, z.ZodType, object][] = [
  ['setFormat: variantId empty', variantSetFormatInput, { ...P, variantId: '', format: 'video' }],
  ['setFormat: format missing', variantSetFormatInput, { ...P }],
  ['setFormat: format gif', variantSetFormatInput, { ...P, format: 'gif' }],
  ['setSound: sound missing', variantSetSoundInput, { ...P }],
  ['setSound: sound loud', variantSetSoundInput, { ...P, sound: 'loud' }],
  ['setSound: assetId empty', variantSetSoundInput, { ...P, sound: 'file', assetId: '' }],
  ['setSound: an asset with clips', variantSetSoundInput, { ...P, sound: 'clips', assetId: 'A1' }],
  ['setSound: an asset with none', variantSetSoundInput, { ...P, sound: 'none', assetId: 'A1' }],
  ['update: nothing to change', variantUpdateInput, { ...P }],
  ['update: durationMs of 499', variantUpdateInput, { ...P, durationMs: 499 }],
  ['update: durationMs past a day', variantUpdateInput, { ...P, durationMs: 86_400_001 }],
  ['update: durationMs not whole', variantUpdateInput, { ...P, durationMs: 1000.5 }],
  ['update: durationMs as text', variantUpdateInput, { ...P, durationMs: '8000' }],
]

describe('the Phase 7 variant inputs refuse each bad field [P7-1]', () => {
  it.each(REFUSED)('%s', (_name, schema, input) => {
    expect(schema.safeParse(input).success).toBe(false)
  })
})

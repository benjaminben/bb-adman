// P7-1 (spec/phases/phase-07.md, "Clips and the track"): the clip command inputs, each strict,
// in whole milliseconds, with a good value and each refused field.
import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import {
  clipAddGeneratedInput,
  clipAddInput,
  clipRemoveInput,
  clipReorderInput,
  clipRestoreInput,
  clipUpdateInput,
} from '@/shared/schemas/commands/clip'

const P = { projectId: 'P1' }
const geometry = { x: 0, y: 0, width: 100, height: 50, rotation: 0, crop: null }
const row = {
  id: 'K1',
  variantId: 'V1',
  assetId: 'A1',
  startMs: 0,
  inMs: 0,
  outMs: 3000,
  placement: null,
  soundOn: true,
}

const GOOD: [string, z.ZodType, object][] = [
  ['clip.add', clipAddInput, { ...P, variantId: 'V1', assetId: 'A1' }],
  ['clip.add placed', clipAddInput, { ...P, variantId: 'V1', assetId: 'A1', startMs: 0 }],
  ['clip.add sized', clipAddInput, { ...P, variantId: 'V1', assetId: 'A1', lengthMs: 100 }],
  ['clip.update start', clipUpdateInput, { ...P, clipId: 'K1', startMs: 1500 }],
  ['clip.update trim', clipUpdateInput, { ...P, clipId: 'K1', inMs: 0, outMs: 100 }],
  ['clip.update placement', clipUpdateInput, { ...P, clipId: 'K1', placement: geometry }],
  ['clip.update no placement', clipUpdateInput, { ...P, clipId: 'K1', placement: null }],
  ['clip.update sound', clipUpdateInput, { ...P, clipId: 'K1', soundOn: false }],
  ['clip.remove', clipRemoveInput, { ...P, clipId: 'K1' }],
  ['clip.reorder', clipReorderInput, { ...P, variantId: 'V1', clipIds: ['K2', 'K1'] }],
  ['clip.restore', clipRestoreInput, { ...P, rows: [row] }],
  ['clip.addGenerated', clipAddGeneratedInput, { ...P, variantId: 'V1', assetId: 'A1' }],
]

describe('clip command inputs take a good value [P7-1]', () => {
  it.each(GOOD)('%s', (_name, schema, input) => {
    expect(schema.safeParse(input).success).toBe(true)
  })

  it.each(GOOD)('%s refuses an unknown key and a missing projectId', (_name, schema, input) => {
    expect(schema.safeParse({ ...input, extra: 1 }).success).toBe(false)
    expect(schema.safeParse({ ...input, projectId: undefined }).success).toBe(false)
  })
})

const add = (over: object) => ({ ...P, variantId: 'V1', assetId: 'A1', ...over })
const update = (over: object) => ({ ...P, clipId: 'K1', ...over })

const REFUSED: [string, z.ZodType, object][] = [
  ['add: variantId empty', clipAddInput, add({ variantId: '' })],
  ['add: assetId missing', clipAddInput, add({ assetId: undefined })],
  ['add: startMs below 0', clipAddInput, add({ startMs: -1 })],
  ['add: startMs not whole', clipAddInput, add({ startMs: 1.5 })],
  ['add: startMs past a day', clipAddInput, add({ startMs: 86_400_001 })],
  ['add: lengthMs below 100', clipAddInput, add({ lengthMs: 99 })],
  ['add: lengthMs not whole', clipAddInput, add({ lengthMs: 100.5 })],
  ['update: clipId empty', clipUpdateInput, update({ clipId: '', startMs: 0 })],
  ['update: nothing to change', clipUpdateInput, update({})],
  ['update: startMs below 0', clipUpdateInput, update({ startMs: -1 })],
  ['update: inMs below 0', clipUpdateInput, update({ inMs: -1 })],
  ['update: outMs not whole', clipUpdateInput, update({ outMs: 200.5 })],
  ['update: trim under 100 ms', clipUpdateInput, update({ inMs: 100, outMs: 199 })],
  ['update: outMs before inMs', clipUpdateInput, update({ inMs: 500, outMs: 100 })],
  [
    'update: placement of width 0',
    clipUpdateInput,
    update({ placement: { ...geometry, width: 0 } }),
  ],
  ['update: soundOn as a number', clipUpdateInput, update({ soundOn: 1 })],
  ['remove: clipId empty', clipRemoveInput, { ...P, clipId: '' }],
  ['reorder: no clips', clipReorderInput, { ...P, variantId: 'V1', clipIds: [] }],
  ['reorder: a clip twice', clipReorderInput, { ...P, variantId: 'V1', clipIds: ['K1', 'K1'] }],
  ['reorder: an empty ID', clipReorderInput, { ...P, variantId: 'V1', clipIds: [''] }],
  ['restore: no rows', clipRestoreInput, { ...P, rows: [] }],
  ['restore: a row with an extra key', clipRestoreInput, { ...P, rows: [{ ...row, z: 1 }] }],
  [
    'restore: a row without outMs',
    clipRestoreInput,
    { ...P, rows: [{ ...row, outMs: undefined }] },
  ],
  ['addGenerated: assetId empty', clipAddGeneratedInput, { ...P, variantId: 'V1', assetId: '' }],
  [
    'addGenerated: a startMs',
    clipAddGeneratedInput,
    { ...P, variantId: 'V1', assetId: 'A1', startMs: 0 },
  ],
]

describe('clip command inputs refuse each bad field [P7-1]', () => {
  it.each(REFUSED)('%s', (_name, schema, input) => {
    expect(schema.safeParse(input).success).toBe(false)
  })
})

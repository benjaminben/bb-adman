// P3-0: the input schemas of spec/editor-commands.md. Every command input is strict, and the
// bounds of name, copy, title, maxDimension and variantRev are enforced here.
import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import {
  layerCreateInput,
  layerDeleteInput,
  layerReorderInput,
  layerReportOverflowInput,
  layerRestoreInput,
  layerUpdateInput,
} from '@/shared/schemas/commands/layer'
import { variantUpdateInput } from '@/shared/schemas/commands/variant'
import { variantGetInput } from '@/shared/schemas/queries/variant'
import { thumbnailGetInput, variantRenderInput } from '@/shared/schemas/queries/render'
import { RENDER_LIMITS } from '@/shared/config/render'
import type { LayerRow } from '@/shared/schemas/rows/layer'

const P = { projectId: 'p1' }
const revs = { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 }
const block = { preset: 'none', startMs: 0, durationMs: 0 } as const
const row: LayerRow = {
  id: 'l1',
  variantId: 'v1',
  key: 'layer-01abc',
  type: 'text',
  slot: null,
  name: 'Text 1',
  z: 1,
  visible: true,
  locked: false,
  linked: false,
  overrides: [],
  copy: 'Hello',
  style: {
    fontAssetId: null,
    fontSize: 40,
    fontWeight: 400,
    color: '#ffffff',
    align: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
  },
  geometry: { x: 0, y: 0, width: 100, height: 50, rotation: 0, crop: null },
  source: null,
  timing: { startMs: 0, endMs: null },
  animation: { entrance: block, exit: block },
  revs,
  syncedRevs: revs,
  translationStatus: null,
  translationSource: null,
  overflow: false,
}

const update = (patch: unknown) => ({ ...P, layerId: 'l1', patch })

// A valid input for each command schema; each is also tried with an unknown key.
const VALID: [string, z.ZodType, unknown][] = [
  ['layer.update', layerUpdateInput, update({ name: 'Logo' })],
  ['layer.create', layerCreateInput, { ...P, variantId: 'v1', type: 'text' }],
  ['layer.delete', layerDeleteInput, { ...P, layerId: 'l1' }],
  ['layer.restore', layerRestoreInput, { ...P, layer: row, order: ['l1'] }],
  ['layer.reorder', layerReorderInput, { ...P, variantId: 'v1', layerIds: ['l2', 'l1'] }],
  [
    'layer.reportOverflow',
    layerReportOverflowInput,
    { ...P, layerId: 'l1', overflow: true, variantRev: 0 },
  ],
  ['variant.update', variantUpdateInput, { ...P, variantId: 'v1', title: 'Summer' }],
]

describe('layer and variant command inputs are strict [spec/editor-commands.md]', () => {
  it.each(VALID)('%s takes a valid input and refuses an unknown key', (_name, schema, input) => {
    expect(schema.safeParse(input).success).toBe(true)
    expect(schema.safeParse({ ...(input as object), extra: 1 }).success).toBe(false)
  })

  it.each(VALID)('%s refuses an input without projectId', (_name, schema, input) => {
    const rest: Record<string, unknown> = { ...(input as object) }
    delete rest.projectId
    expect(schema.safeParse(rest).success).toBe(false)
  })
})

const long = (n: number) => 'a'.repeat(n)

// [input, accepted]: the bounds of each field, at and just past each edge.
const BOUNDS: [string, z.ZodType, unknown, boolean][] = [
  ['name of 1 character', layerUpdateInput, update({ name: 'a' }), true],
  ['name of 100 characters', layerUpdateInput, update({ name: long(100) }), true],
  ['name of 101 characters', layerUpdateInput, update({ name: long(101) }), false],
  ['name of only spaces', layerUpdateInput, update({ name: '   ' }), false],
  ['empty copy', layerUpdateInput, update({ copy: '' }), true],
  ['copy of 5,000 characters', layerUpdateInput, update({ copy: long(5000) }), true],
  ['copy of 5,001 characters', layerUpdateInput, update({ copy: long(5001) }), false],
  ['an empty patch', layerUpdateInput, update({}), false],
  ['an unknown patch key', layerUpdateInput, update({ z: 3 }), false],
  ['a text style patch', layerUpdateInput, update({ style: { fontSize: 20 } }), true],
  ['an image style patch', layerUpdateInput, update({ style: { opacity: 0.5 } }), true],
  ['a mixed style patch', layerUpdateInput, update({ style: { opacity: 1, fontSize: 9 } }), false],
  ['a geometry patch', layerUpdateInput, update({ geometry: { x: -5, rotation: 270 } }), true],
  ['width below 1', layerUpdateInput, update({ geometry: { width: 0.5 } }), false],
  ['an infinite x', layerUpdateInput, update({ geometry: { x: Infinity } }), false],
  ['a crop below 1', layerUpdateInput, update({ geometry: { crop: cropOf(0) } }), false],
  ['a crop of 1', layerUpdateInput, update({ geometry: { crop: cropOf(1) } }), true],
  ['no crop', layerUpdateInput, update({ geometry: { crop: null } }), true],
  ['no source', layerUpdateInput, update({ source: null }), true],
  [
    'a source with an extra key',
    layerUpdateInput,
    update({ source: { assetId: 'a', x: 1 } }),
    false,
  ],
  ['one animation block', layerUpdateInput, update({ animation: { exit: block } }), true],
  ['a timing', layerUpdateInput, update({ timing: { startMs: 0, endMs: null } }), true],
  ['create with values', layerCreateInput, createWith({ name: 'Logo', copy: 'Hi' }), true],
  ['create with a 101-character name', layerCreateInput, createWith({ name: long(101) }), false],
  [
    'create with timing',
    layerCreateInput,
    createWith({ timing: { startMs: 0, endMs: null } }),
    false,
  ],
  [
    'create of a background',
    layerCreateInput,
    { ...P, variantId: 'v1', type: 'background' },
    false,
  ],
  ['restore with a broken row', layerRestoreInput, { ...P, layer: { id: 'l1' }, order: [] }, false],
  ['title of 1 character', variantUpdateInput, title('a'), true],
  ['title of 200 characters', variantUpdateInput, title(long(200)), true],
  ['title of 201 characters', variantUpdateInput, title(long(201)), false],
  ['title of only spaces', variantUpdateInput, title('  '), false],
  ['a durationMs of 5000', variantUpdateInput, { ...title('a'), durationMs: 5000 }, true],
  ['variantRev 0', layerReportOverflowInput, overflowAt(0), true],
  ['variantRev -1', layerReportOverflowInput, overflowAt(-1), false],
  ['variantRev 1.5', layerReportOverflowInput, overflowAt(1.5), false],
  ['maxDimension 64', variantRenderInput, renderAt(64), true],
  ['maxDimension 63', variantRenderInput, renderAt(63), false],
  ['maxDimension 2048', variantRenderInput, renderAt(RENDER_LIMITS.maxDimension), true],
  ['maxDimension 2049', variantRenderInput, renderAt(2049), false],
  ['maxDimension 100.5', variantRenderInput, renderAt(100.5), false],
]

function cropOf(size: number) {
  return { x: 0, y: 0, width: size, height: size }
}
function createWith(values: unknown) {
  return { ...P, variantId: 'v1', type: 'image', values }
}
function title(t: string) {
  return { ...P, variantId: 'v1', title: t }
}
function overflowAt(variantRev: number) {
  return { ...P, layerId: 'l1', overflow: false, variantRev }
}
function renderAt(maxDimension: number) {
  return { ...P, variantId: 'v1', maxDimension }
}

describe('bounds of the inputs [spec/editor-commands.md]', () => {
  it.each(BOUNDS)('%s', (_case, schema, input, accepted) => {
    expect(schema.safeParse(input).success).toBe(accepted)
  })

  it('trims a name and a title', () => {
    expect(layerUpdateInput.parse(update({ name: '  Logo ' })).patch.name).toBe('Logo')
    expect(variantUpdateInput.parse(title(' Summer ')).title).toBe('Summer')
  })
})

describe('query inputs [spec/editor-commands.md, Queries]', () => {
  it('variant.render draws at 1024 when maxDimension is left out', () => {
    expect(variantRenderInput.parse({ ...P, variantId: 'v1' }).maxDimension).toBe(1024)
  })

  it('variant.get and thumbnail.get need a variantId', () => {
    for (const schema of [variantGetInput, thumbnailGetInput]) {
      expect(schema.safeParse({ ...P, variantId: 'v1' }).success).toBe(true)
      expect(schema.safeParse(P).success).toBe(false)
    }
  })
})

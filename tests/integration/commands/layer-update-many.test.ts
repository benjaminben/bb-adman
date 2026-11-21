// P4-7 (security class): layer.updateMany, a new command open to agents. Each item follows
// layer.update; the whole command is all or nothing, one rev bump, one undo entry
// (spec/ai-jobs.md "Layout proposal"; spec/editor-commands.md "layer.update").
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { insertTestAsset } from '../assets/asset-rows'
import { makeLayerBus, TEST_NOW, type LayerBus } from './layer-fixture'
import type { LayerRow } from '@/shared/schemas/rows/layer'

let bus: LayerBus
beforeEach(async () => {
  bus = await makeLayerBus()
  insertTestAsset(bus.db, { id: 'pic', relPath: 'p.png', absPath: '/p.png' })
  insertTestAsset(bus.db, {
    id: 'ref-pic',
    relPath: 'r.png',
    absPath: '/r.png',
    library: 'reference',
  })
  insertTestAsset(bus.db, { id: 'font', relPath: 'f.ttf', absPath: '/f.ttf', kind: 'font' })
})
afterEach(() => bus.cleanup())

type Update = { layerId: string; patch: Record<string, unknown> }
const many = (updates: Update[], actor: 'user' | 'agent' = 'user', variantId?: string) =>
  bus.bus.execute(
    'layer.updateMany',
    { projectId: bus.projectId, variantId: variantId ?? bus.variantId, updates },
    { actor },
  )

const ZERO = { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 }
const values = (l: LayerRow) => ({ ...l, revs: null })

// A second variant with one text layer, made by copying the first variant's rows.
function addOtherVariant(): string {
  bus.db
    .prepare(
      `INSERT INTO variant (id, direction_id, title, width, height, size_label, language, format,
        duration_ms, created_by, created_at)
       SELECT 'v-other', direction_id, title, width, height, 'other size', language, format,
        duration_ms, created_by, created_at FROM variant WHERE id = ?`,
    )
    .run(bus.variantId)
  bus.db
    .prepare(
      `INSERT INTO layer (id, variant_id, key, type, slot, name, z, visible, locked, linked,
        overrides, copy, style, geometry, source, timing, animation, revs, synced_revs, overflow)
       SELECT 'other-text', 'v-other', key, type, slot, name, z, visible, locked, linked,
        overrides, copy, style, geometry, source, timing, animation, revs, synced_revs, overflow
       FROM layer WHERE id = ?`,
    )
    .run(bus.ids.text)
  return 'other-text'
}

describe('layer.updateMany [spec/ai-jobs.md "Layout proposal"]', () => {
  it('writes every patch, bumps variant.rev once and answers the changed layers', async () => {
    const result = await bus.changed(() =>
      many([
        { layerId: bus.ids.text, patch: { geometry: { x: 5 }, style: { fontSize: 30 } } },
        { layerId: bus.ids.image, patch: { source: { assetId: 'pic' } } },
      ]),
    )
    expect(result).toEqual({ ok: true, data: { layerIds: [bus.ids.text, bus.ids.image] } })
    expect(bus.layer(bus.ids.text).geometry.x).toBe(5)
    expect(bus.layer(bus.ids.text).revs).toEqual({ ...ZERO, style: 1, geometry: 1 })
    expect(bus.layer(bus.ids.image).revs).toEqual({ ...ZERO, source: 1 })
    expect(bus.variant().rev).toBe(1)
  })

  it('adds one undo entry; undo restores every layer and redo puts the changes back', async () => {
    const ids = [bus.ids.text, bus.ids.image, bus.ids.background]
    const before = ids.map((id) => values(bus.layer(id)))
    await many([
      { layerId: bus.ids.text, patch: { copy: 'New', style: { align: 'left' } } },
      { layerId: bus.ids.image, patch: { geometry: { width: 7 }, locked: true } },
      { layerId: bus.ids.background, patch: { source: { assetId: 'pic' } } },
    ])
    const after = ids.map((id) => values(bus.layer(id)))
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(ids.map((id) => values(bus.layer(id)))).toEqual(before)
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: true })
    expect(await bus.history('redo')).toMatchObject({ ok: true })
    expect(ids.map((id) => values(bus.layer(id)))).toEqual(after)
  })

  it('puts one layer.updateMany on the list, leaving out items that changed nothing', async () => {
    const stored = bus.layer(bus.ids.text)
    await many([
      { layerId: bus.ids.text, patch: { name: stored.name } },
      { layerId: bus.ids.image, patch: { name: 'Brand' } },
    ])
    expect(bus.undo.takeUndo(bus.projectId, `variant:${bus.variantId}`)).toEqual({
      name: 'layer.updateMany',
      input: {
        projectId: bus.projectId,
        variantId: bus.variantId,
        updates: [{ layerId: bus.ids.image, patch: { name: 'Logo' } }],
      },
    })
  })

  it('changes nothing when every patch equals what is stored, and still answers ok', async () => {
    const stored = bus.layer(bus.ids.text)
    const result = await bus.changed(() =>
      many([{ layerId: bus.ids.text, patch: { copy: stored.copy } }], 'agent'),
    )
    expect(result).toEqual({ ok: true, data: { layerIds: [] } })
    expect(bus.variant()).toMatchObject({ rev: 0, agentChangedAt: null })
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it('may change a locked layer [A-27]', async () => {
    await bus.update(bus.ids.image, { locked: true })
    expect(await many([{ layerId: bus.ids.image, patch: { name: 'A' } }], 'agent')).toMatchObject({
      ok: true,
    })
  })

  it.each(['user', 'agent'] as const)(
    'stamps agent_changed_at only for the agent: %s',
    async (actor) => {
      await many([{ layerId: bus.ids.text, patch: { copy: 'X' } }], actor)
      expect(bus.variant()).toMatchObject({
        rev: 1,
        agentChangedAt: actor === 'agent' ? TEST_NOW : null,
      })
    },
  )
})

describe('layer.updateMany refusals: all or nothing', () => {
  const good = (): Update => ({ layerId: bus.ids.background, patch: { name: 'Changed' } })

  it.each<[string, () => Update, string, string, string | undefined]>([
    [
      'an unknown layer',
      () => ({ layerId: 'nope', patch: { name: 'A' } }),
      'NOT_FOUND',
      'That layer was not found.',
      undefined,
    ],
    [
      'a layer of another variant',
      () => ({ layerId: addOtherVariant(), patch: { name: 'A' } }),
      'NOT_FOUND',
      'That layer was not found.',
      undefined,
    ],
    [
      'copy on a picture',
      () => ({ layerId: bus.ids.image, patch: { copy: 'A' } }),
      'INVALID_INPUT',
      'Only a text layer has text.',
      undefined,
    ],
    [
      'a source on text',
      () => ({ layerId: bus.ids.text, patch: { source: null } }),
      'INVALID_INPUT',
      'A text layer has no picture.',
      undefined,
    ],
    [
      'a text style on a picture',
      () => ({ layerId: bus.ids.image, patch: { style: { fontSize: 3 } } }),
      'INVALID_INPUT',
      'Those style values do not fit this layer.',
      undefined,
    ],
    [
      'an asset of no project',
      () => ({ layerId: bus.ids.image, patch: { source: { assetId: 'gone' } } }),
      'NOT_FOUND',
      'That file is not in this project.',
      undefined,
    ],
    [
      'a font as a picture',
      () => ({ layerId: bus.ids.image, patch: { source: { assetId: 'font' } } }),
      'INVALID_INPUT',
      'Choose a picture for a picture layer.',
      undefined,
    ],
    [
      'a picture as a font',
      () => ({ layerId: bus.ids.text, patch: { style: { fontAssetId: 'pic' } } }),
      'INVALID_INPUT',
      'Choose a font file.',
      undefined,
    ],
    [
      'a reference picture',
      () => ({ layerId: bus.ids.image, patch: { source: { assetId: 'ref-pic' } } }),
      'RULE_VIOLATION',
      'This file is in the reference library. Move it to the asset library to use it on a post.',
      'reference_library',
    ],
  ])(
    'refuses the whole command for %s after a good item, writing nothing',
    async (_, bad, code, message, reason) => {
      const item = bad()
      const error = await expectRefused(bus, () => many([good(), item], 'agent'), code, reason)
      expect(error.message).toBe(message)
      expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
    },
  )

  it('refuses a layer named twice, writing nothing', async () => {
    const error = await expectRefused(
      bus,
      () => many([good(), { layerId: bus.ids.background, patch: { name: 'B' } }]),
      'INVALID_INPUT',
    )
    expect(error.message).toBe('Name each layer once.')
  })

  it('refuses an unknown variant as an unknown layer', async () => {
    const error = await expectRefused(bus, () => many([good()], 'user', 'nope'), 'NOT_FOUND')
    expect(error.message).toBe('That layer was not found.')
  })
})

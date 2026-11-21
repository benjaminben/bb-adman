import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { insertTestAsset } from '../assets/asset-rows'
import { makeLayerBus, type LayerBus } from './layer-fixture'
import type { LayerRow } from '@/shared/schemas/rows/layer'

let bus: LayerBus
beforeEach(async () => {
  bus = await makeLayerBus()
  insertTestAsset(bus.db, { id: 'pic', relPath: 'p.png', absPath: '/p.png' })
  insertTestAsset(bus.db, { id: 'font', relPath: 'f.ttf', absPath: '/f.ttf', kind: 'font' })
})
afterEach(() => bus.cleanup())

const ZERO = { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 }
const FADE = { preset: 'fade', startMs: 0, durationMs: 500 }

describe('layer.update [FR-091 to FR-094, FR-194, FR-249]', () => {
  it('writes the patch, answers the layer ID and names the layer and variant rows', async () => {
    const id = bus.ids.text
    const result = await bus.changed(() =>
      bus.update(id, {
        name: ' Title ',
        copy: 'Hello',
        style: { fontSize: 40, letterSpacing: 0.1 },
        geometry: { x: 5, rotation: 190 },
      }),
    )
    expect(result).toEqual({ ok: true, data: { layerId: id } })
    const layer = bus.layer(id)
    expect(layer).toMatchObject({ name: 'Title', copy: 'Hello' })
    expect(layer.style).toMatchObject({ fontSize: 40, letterSpacing: 0.1, color: '#FFFFFF' })
    expect(layer.geometry).toEqual({
      x: 5,
      y: 670,
      width: 950,
      height: 238,
      rotation: -170,
      crop: null,
    })
    expect(layer.revs).toEqual({ ...ZERO, copy: 1, style: 1, geometry: 1 })
    expect(bus.variant().rev).toBe(1)
  })

  it.each<[string, keyof LayerBus['ids'], Record<string, unknown>, keyof typeof ZERO | null]>([
    ['copy', 'text', { copy: 'New' }, 'copy'],
    ['style', 'image', { style: { opacity: 0.5 } }, 'style'],
    ['font', 'text', { style: { fontAssetId: 'font' } }, 'style'],
    ['geometry', 'image', { geometry: { width: 300 } }, 'geometry'],
    ['crop', 'image', { geometry: { crop: { x: 0, y: 0, width: 10, height: 10 } } }, 'geometry'],
    ['source', 'image', { source: { assetId: 'pic' } }, 'source'],
    ['background source', 'background', { source: { assetId: 'pic' } }, 'source'],
    ['timing', 'image', { timing: { startMs: 100, endMs: 900 } }, 'timing'],
    ['animation', 'text', { animation: { exit: FADE } }, 'animation'],
    ['name', 'image', { name: 'Brand' }, null],
    ['visible', 'image', { visible: false }, null],
    ['locked', 'image', { locked: true }, null],
  ])(
    '%s: bumps only its own group counter and variant.rev once',
    async (_, which, patch, group) => {
      const id = bus.ids[which]
      expect(await bus.changed(() => bus.update(id, patch))).toMatchObject({ ok: true })
      expect(bus.layer(id).revs).toEqual(group ? { ...ZERO, [group]: 1 } : ZERO)
      expect(bus.variant().rev).toBe(1)
    },
  )

  it('bumps no counter for a group whose merged value did not change', async () => {
    const id = bus.ids.text
    await bus.update(id, { style: { fontSize: 81 }, geometry: { x: 1 } })
    expect(bus.layer(id).revs).toEqual({ ...ZERO, geometry: 1 })
  })

  it('stores rotation folded into (-180, 180]', async () => {
    const id = bus.ids.image
    const folded = []
    for (const rotation of [-180, 180, 540, -190, 360, 45]) {
      await bus.update(id, { geometry: { rotation } })
      folded.push(bus.layer(id).geometry.rotation)
    }
    expect(folded).toEqual([180, 180, 180, 170, 0, 45])
  })

  it('may change a locked layer, from the user or the agent [A-27]', async () => {
    const id = bus.ids.image
    await bus.update(id, { locked: true })
    expect(await bus.update(id, { name: 'A' })).toMatchObject({ ok: true })
    expect(await bus.update(id, { name: 'B' }, 'agent')).toMatchObject({ ok: true })
    expect(bus.layer(id).name).toBe('B')
  })

  it('changes nothing for a patch equal to what is stored, and still answers ok', async () => {
    const id = bus.ids.text
    const stored = bus.layer(id)
    const same = {
      name: stored.name,
      copy: stored.copy,
      style: { fontSize: 81 },
      geometry: { rotation: 360 },
      animation: { entrance: stored.animation.entrance },
    }
    const result = await bus.changed(() => bus.update(id, same))
    expect(result).toEqual({ ok: true, data: { layerId: id } })
    expect(bus.layer(id)).toEqual(stored)
    expect(bus.variant().rev).toBe(0)
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it("puts on the variant's list only the changed fields, blocks and keys", async () => {
    const id = bus.ids.text
    await bus.update(id, {
      name: 'Headline',
      style: { fontSize: 50, color: '#FFFFFF' },
      geometry: { x: 1, y: 670 },
      animation: { entrance: FADE, exit: { preset: 'none', startMs: 0, durationMs: 0 } },
    })
    const inverse = bus.undo.takeUndo(bus.projectId, `variant:${bus.variantId}`)
    expect(inverse).toEqual({
      name: 'layer.update',
      input: {
        projectId: bus.projectId,
        layerId: id,
        patch: {
          style: { fontSize: 81 },
          geometry: { x: 65 },
          animation: { entrance: { preset: 'none', startMs: 0, durationMs: 0 } },
        },
      },
    })
  })

  it.each<[keyof LayerBus['ids'], Record<string, unknown>]>([
    ['text', { name: 'X' }],
    ['text', { visible: false, locked: true }],
    ['text', { copy: '' }],
    ['text', { style: { fontAssetId: 'font', align: 'left' } }],
    ['image', { style: { opacity: 0 } }],
    ['image', { geometry: { x: 1, crop: { x: 1, y: 2, width: 3, height: 4 } } }],
    ['background', { source: { assetId: 'pic' } }],
    ['image', { timing: { startMs: 5, endMs: null } }],
    ['text', { animation: { entrance: FADE, exit: FADE } }],
  ])('%s %j: undo restores every field and redo puts the change back', async (which, patch) => {
    const id = bus.ids[which]
    const values = (l: LayerRow) => ({ ...l, revs: null })
    const before = values(bus.layer(id))
    await bus.update(id, patch)
    const after = values(bus.layer(id))
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(values(bus.layer(id))).toEqual(before)
    expect(await bus.history('redo')).toMatchObject({ ok: true })
    expect(values(bus.layer(id))).toEqual(after)
  })
})

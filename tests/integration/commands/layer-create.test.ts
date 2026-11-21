import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { insertTestAsset } from '../assets/asset-rows'
import { makeLayerBus, type LayerBus } from './layer-fixture'
import { layersOf, orderOf } from './layer-order'

let bus: LayerBus
beforeEach(async () => {
  bus = await makeLayerBus()
  insertTestAsset(bus.db, { id: 'pic', relPath: 'p.png', absPath: '/p.png' })
  insertTestAsset(bus.db, { id: 'ref', relPath: 'r.png', absPath: '/r.png', library: 'reference' })
  insertTestAsset(bus.db, { id: 'font', relPath: 'f.ttf', absPath: '/f.ttf', kind: 'font' })
})
afterEach(() => bus.cleanup())

const ZERO = { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 }
const create = (input: Record<string, unknown>) =>
  bus.user('layer.create', { variantId: bus.variantId, ...input })
const topZ = () => Math.max(...layersOf(bus).map((l) => l.z))
const idOf = (result: unknown) => (result as { data: { layerId: string } }).data.layerId

describe('layer.create [FR-090, FR-194]', () => {
  it('adds a picture layer on top with a new key, no slot and no picture', async () => {
    const top = topZ()
    const result = await bus.changed(() => create({ type: 'image' }))
    expect(result).toMatchObject({ ok: true })
    const layer = bus.layer(idOf(result))
    expect(layer.key).toMatch(/^layer-[0-9a-z]{26}$/)
    expect(layer).toMatchObject({
      variantId: bus.variantId,
      type: 'image',
      slot: null,
      name: 'Picture 2',
      z: top + 1,
      source: null,
      linked: false,
      overrides: [],
      revs: ZERO,
      syncedRevs: ZERO,
      translationStatus: null,
      translationSource: null,
      overflow: false,
    })
    expect(bus.variant().rev).toBe(1)
  })

  it('gives each added layer its own key and the next z', async () => {
    const a = idOf(await create({ type: 'text' }))
    const b = idOf(await create({ type: 'text' }))
    expect(bus.layer(a).key).not.toBe(bus.layer(b).key)
    expect(bus.layer(b).z).toBe(bus.layer(a).z + 1)
    expect(bus.layer(b).name).toBe('Text 3')
  })

  it('merges the given values over the starting values, as layer.update merges a patch', async () => {
    const result = await create({
      type: 'text',
      values: {
        name: ' Offer ',
        copy: 'Half price',
        style: { fontSize: 30, fontAssetId: 'font' },
        geometry: { x: 4, rotation: 270 },
        visible: false,
        locked: true,
      },
    })
    const layer = bus.layer(idOf(result))
    expect(layer).toMatchObject({ name: 'Offer', copy: 'Half price', visible: false, locked: true })
    expect(layer.style).toMatchObject({ fontSize: 30, fontAssetId: 'font', fontWeight: 700 })
    expect(layer.geometry).toMatchObject({ x: 4, y: 454, rotation: -90 })
    expect(layer.revs).toEqual(ZERO)
  })

  it('takes a picture for a picture layer', async () => {
    const result = await create({ type: 'image', values: { source: { assetId: 'pic' } } })
    expect(bus.layer(idOf(result)).source).toEqual({ assetId: 'pic' })
  })

  it('stamps agent_changed_at when the agent adds a layer [FR-239]', async () => {
    expect(
      await bus.agent('layer.create', { variantId: bus.variantId, type: 'image' }),
    ).toMatchObject({ ok: true })
    expect(bus.variant().agentChangedAt).not.toBeNull()
  })

  it('undo deletes the layer and redo brings it back with the same ID and key', async () => {
    const before = orderOf(bus)
    const id = idOf(await create({ type: 'image' }))
    const added = { ...bus.layer(id), z: null }
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.db.prepare('SELECT id FROM layer WHERE id = ?').get(id)).toBeUndefined()
    expect(orderOf(bus)).toEqual(before)
    expect(await bus.history('redo')).toMatchObject({ ok: true })
    expect({ ...bus.layer(id), z: null }).toEqual(added)
    expect(orderOf(bus)).toEqual([...before, id])
  })

  it.each<[string, Record<string, unknown>, string, string, string | undefined]>([
    [
      'text on a picture',
      { type: 'image', values: { copy: 'A' } },
      'INVALID_INPUT',
      'Only a text layer has text.',
      undefined,
    ],
    [
      'a picture on text',
      { type: 'text', values: { source: { assetId: 'pic' } } },
      'INVALID_INPUT',
      'A text layer has no picture.',
      undefined,
    ],
    [
      'a text style on a picture',
      { type: 'image', values: { style: { fontSize: 9 } } },
      'INVALID_INPUT',
      'Those style values do not fit this layer.',
      undefined,
    ],
    [
      'an unknown picture',
      { type: 'image', values: { source: { assetId: 'gone' } } },
      'NOT_FOUND',
      'That file is not in this project.',
      undefined,
    ],
    [
      'a font as a picture',
      { type: 'image', values: { source: { assetId: 'font' } } },
      'INVALID_INPUT',
      'Choose a picture for a picture layer.',
      undefined,
    ],
    [
      'a picture as a font',
      { type: 'text', values: { style: { fontAssetId: 'pic' } } },
      'INVALID_INPUT',
      'Choose a font file.',
      undefined,
    ],
    [
      'a reference picture',
      { type: 'image', values: { source: { assetId: 'ref' } } },
      'RULE_VIOLATION',
      'This file is in the reference library. Move it to the asset library to use it on a post.',
      'reference_library',
    ],
    [
      'an unknown variant',
      { type: 'image', variantId: 'no-such-variant' },
      'NOT_FOUND',
      'That variant was not found.',
      undefined,
    ],
  ])('refuses %s', async (_, input, code, message, reason) => {
    const error = await expectRefused(bus, () => create(input), code, reason)
    expect(error.message).toBe(message)
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it.each<Record<string, unknown>>([
    { type: 'background' },
    { type: 'image', values: { z: 3 } },
    { type: 'image', values: { timing: { startMs: 0, endMs: null } } },
    { type: 'text', values: { name: ' ' } },
  ])('refuses the input %j with INVALID_INPUT', async (input) => {
    await expectRefused(bus, () => create(input), 'INVALID_INPUT')
  })
})

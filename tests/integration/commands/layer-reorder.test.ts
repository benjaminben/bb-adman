import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { makeLayerBus, type LayerBus } from './layer-fixture'
import { orderOf, zOf } from './layer-order'

let bus: LayerBus
let stored: string[]
beforeEach(async () => {
  bus = await makeLayerBus()
  await bus.user('layer.create', { variantId: bus.variantId, type: 'text' })
  // The fixture leaves a gap in z; a reorder in the stored order closes it.
  await bus.user('layer.reorder', { variantId: bus.variantId, layerIds: orderOf(bus) })
  while (bus.undo.takeUndo(bus.projectId, `variant:${bus.variantId}`));
  stored = orderOf(bus)
})
afterEach(() => bus.cleanup())

const reorder = (layerIds: string[], variantId = bus.variantId) =>
  bus.user('layer.reorder', { variantId, layerIds })

describe('layer.reorder [FR-092]', () => {
  it('sets z to 1, 2, 3 in the given order and keeps the background at 0', async () => {
    const reversed = [...stored].reverse()
    const rev = bus.variant().rev
    const result = await bus.changed(() => reorder(reversed))
    expect(result).toEqual({ ok: true, data: { variantId: bus.variantId } })
    expect(orderOf(bus)).toEqual(reversed)
    expect(zOf(bus)).toEqual([0, 1, 2, 3])
    expect(bus.layer(bus.ids.background).z).toBe(0)
    expect(bus.variant().rev).toBe(rev + 1)
  })

  it('changes nothing for the stored order, and still answers ok', async () => {
    const rev = bus.variant().rev
    const result = await bus.changed(() => reorder(stored))
    expect(result).toEqual({ ok: true, data: { variantId: bus.variantId } })
    expect(bus.variant().rev).toBe(rev)
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it('undo puts the old order back and redo the new one', async () => {
    const moved = [stored[2] ?? '', stored[0] ?? '', stored[1] ?? '']
    await reorder(moved)
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(orderOf(bus)).toEqual(stored)
    expect(await bus.history('redo')).toMatchObject({ ok: true })
    expect(orderOf(bus)).toEqual(moved)
  })

  it.each<[string, () => string[]]>([
    ['an empty list', () => []],
    ['a layer missing', () => stored.slice(1)],
    ['a layer twice', () => [...stored, stored[0] ?? '']],
    ['a layer twice in place of another', () => [stored[0] ?? '', ...stored.slice(0, -1)]],
    ['an unknown layer', () => [...stored.slice(1), 'no-such-layer']],
  ])('refuses %s with INVALID_INPUT', async (_, layerIds) => {
    const error = await expectRefused(bus, () => reorder(layerIds()), 'INVALID_INPUT')
    expect(error.message).toBe('List every layer of the variant once, without the background.')
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it('refuses a list naming the background with background_layer', async () => {
    const layerIds = [bus.ids.background, ...stored]
    await expectRefused(bus, () => reorder(layerIds), 'RULE_VIOLATION', 'background_layer')
  })

  it('refuses an unknown variant with NOT_FOUND', async () => {
    const error = await expectRefused(bus, () => reorder(stored, 'no-such-variant'), 'NOT_FOUND')
    expect(error.message).toBe('That variant was not found.')
  })
})

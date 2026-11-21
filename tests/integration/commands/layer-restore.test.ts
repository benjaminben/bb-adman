import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { makeFixture } from '../core-fixture'
import { makeLayerBus, type LayerBus } from './layer-fixture'
import { orderOf } from './layer-order'
import type { LayerRow } from '@/shared/schemas/rows/layer'

type RestoreInput = { projectId: string; layer: LayerRow; order: string[] }

let bus: LayerBus
let input: RestoreInput
beforeEach(async () => {
  bus = await makeLayerBus()
  await bus.user('layer.delete', { layerId: bus.ids.image })
  const call = bus.undo.takeUndo(bus.projectId, `variant:${bus.variantId}`)
  input = call?.input as RestoreInput
})
afterEach(() => bus.cleanup())

const restore = (changes: Partial<RestoreInput> = {}) =>
  bus.user('layer.restore', { ...input, ...changes })

describe('layer.restore [spec/editor-commands.md]', () => {
  it('puts the row back with its own ID, key and values, and sets z from the order', async () => {
    const result = await bus.changed(() => restore())
    expect(result).toEqual({ ok: true, data: { layerId: bus.ids.image } })
    expect(bus.layer(bus.ids.image)).toEqual({ ...input.layer, z: input.order.length })
    expect(orderOf(bus)).toEqual(input.order)
    expect(bus.variant().rev).toBe(2)
  })

  it('puts layer.delete of that layer on the undo list', async () => {
    await restore()
    expect(bus.undo.takeUndo(bus.projectId, `variant:${bus.variantId}`)).toEqual({
      name: 'layer.delete',
      input: { projectId: bus.projectId, layerId: bus.ids.image },
    })
  })

  it.each<[string, () => Partial<RestoreInput>]>([
    ['the same ID', () => ({ layer: { ...input.layer, id: bus.ids.text } })],
    ['the same key in the variant', () => ({ layer: { ...input.layer, key: 'headline' } })],
  ])('refuses a layer with %s with layer_exists', async (_, changes) => {
    const before = changes()
    const order = before.layer ? [...orderOf(bus), before.layer.id] : input.order
    const error = await expectRefused(
      bus,
      () => restore({ ...before, order }),
      'RULE_VIOLATION',
      'layer_exists',
    )
    expect(error.message).toBe('That layer is already there.')
  })

  it.each<[string, () => string[]]>([
    ['without the layer', () => orderOf(bus)],
    ['with a layer twice', () => [...input.order, bus.ids.text]],
    ['with a layer missing', () => input.order.filter((id) => id !== bus.ids.text)],
    ['with the background', () => [bus.ids.background, ...input.order]],
  ])('refuses an order %s with INVALID_INPUT', async (_, order) => {
    const error = await expectRefused(bus, () => restore({ order: order() }), 'INVALID_INPUT')
    expect(error.message).toBe('List every layer of the variant once, without the background.')
  })

  it('refuses a layer whose variant is gone with NOT_FOUND', async () => {
    const layer = { ...input.layer, variantId: 'no-such-variant' }
    const error = await expectRefused(bus, () => restore({ layer }), 'NOT_FOUND')
    expect(error.message).toBe('That variant was not found.')
  })

  it('is internal: a window may not send it, while layer.delete is open to it', () => {
    const f = makeFixture()
    try {
      expect(f.core.isInternal('layer.restore')).toBe(true)
      expect(f.core.isInternal('layer.delete')).toBe(false)
    } finally {
      f.cleanup()
    }
  })
})

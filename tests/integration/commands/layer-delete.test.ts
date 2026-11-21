import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { makeLayerBus, type LayerBus } from './layer-fixture'
import { layersOf, orderOf, zOf } from './layer-order'

let bus: LayerBus
let added: string
beforeEach(async () => {
  bus = await makeLayerBus()
  const result = await bus.user('layer.create', { variantId: bus.variantId, type: 'text' })
  added = (result as { data: { layerId: string } }).data.layerId
  // The fixture leaves a gap in z; a reorder in the stored order closes it.
  await bus.user('layer.reorder', { variantId: bus.variantId, layerIds: orderOf(bus) })
  while (bus.undo.takeUndo(bus.projectId, `variant:${bus.variantId}`));
})
afterEach(() => bus.cleanup())

const remove = (layerId: string) => bus.user('layer.delete', { layerId })

describe('layer.delete [FR-092, FR-197]', () => {
  it('removes the layer, closes up z and names the removed and moved rows', async () => {
    const before = orderOf(bus)
    const rev = bus.variant().rev
    const result = await bus.changed(() => remove(bus.ids.text))
    expect(result).toEqual({ ok: true, data: { layerId: bus.ids.text } })
    expect(bus.db.prepare('SELECT 1 FROM layer WHERE id = ?').get(bus.ids.text)).toBeUndefined()
    expect(orderOf(bus)).toEqual(before.filter((id) => id !== bus.ids.text))
    expect(zOf(bus)).toEqual(layersOf(bus).map((_, i) => i))
    expect(bus.variant().rev).toBe(rev + 1)
  })

  it('leaves a job that names the deleted layer as it is', async () => {
    bus.db
      .prepare(
        `INSERT INTO job (id, kind, status, layer_id, request, created_at, updated_at)
         VALUES ('job-1', 'image_generation', 'succeeded', ?, '{}', 'now', 'now')`,
      )
      .run(added)
    expect(await remove(added)).toMatchObject({ ok: true })
    expect(bus.db.prepare('SELECT layer_id FROM job').get()).toEqual({ layer_id: added })
  })

  it('undo restores the row, its counters and the order; redo deletes it again', async () => {
    await bus.update(added, { copy: 'Kept', style: { fontSize: 12 } })
    bus.db.prepare('UPDATE layer SET overflow = 1 WHERE id = ?').run(added)
    const row = bus.layer(added)
    const order = orderOf(bus)
    expect(await remove(added)).toMatchObject({ ok: true })
    const rev = bus.variant().rev
    expect(await bus.changed(() => bus.history('undo'))).toMatchObject({ ok: true })
    expect(bus.layer(added)).toEqual(row)
    expect(bus.layer(added).revs).toMatchObject({ copy: 1, style: 1 })
    expect(orderOf(bus)).toEqual(order)
    expect(bus.variant().rev).toBe(rev + 1)
    expect(await bus.history('redo')).toMatchObject({ ok: true })
    expect(bus.db.prepare('SELECT 1 FROM layer WHERE id = ?').get(added)).toBeUndefined()
  })

  it('undo puts a layer from the middle back in its place', async () => {
    const order = orderOf(bus)
    const middle = order[1] ?? ''
    await remove(middle)
    await bus.history('undo')
    expect(orderOf(bus)).toEqual(order)
    expect(bus.layer(middle).z).toBe(2)
  })

  it('refuses the background layer with background_layer', async () => {
    const error = await expectRefused(
      bus,
      () => remove(bus.ids.background),
      'RULE_VIOLATION',
      'background_layer',
    )
    expect(error.message).toBe('The background layer stays at the bottom and cannot be deleted.')
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it('refuses an unknown layer with NOT_FOUND', async () => {
    const error = await expectRefused(bus, () => remove('no-such-layer'), 'NOT_FOUND')
    expect(error.message).toBe('That layer was not found.')
  })
})

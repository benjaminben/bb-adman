// P5-3: an edit on a linked layer adds the override paths that follow for its variant, and its
// undo goes through layer.revert so the list comes back too (spec/links-and-sync.md,
// "Overrides"; A-135, A-136).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { makeLayerBus, type LayerBus } from '../commands/layer-fixture'
import { addLinkedVariant, linkedLayerId } from './linked-fixture'
import type { LayerRow } from '@/shared/schemas/rows/layer'

let bus: LayerBus
let record: ReturnType<typeof vi.spyOn>
let textKey: string
beforeEach(async () => {
  bus = await makeLayerBus()
  textKey = bus.layer(bus.ids.text).key
  const { height } = bus.variant()
  addLinkedVariant(bus.db, bus.variantId, 'same')
  addLinkedVariant(bus.db, bus.variantId, 'tall', { height: height + 100 })
  addLinkedVariant(bus.db, bus.variantId, 'de', { language: 'de-DE' })
  bus.db.prepare('UPDATE layer SET linked = 0 WHERE id = ?').run(linkedLayerId('same', 'logo'))
  record = vi.spyOn(bus.undo, 'record')
})
afterEach(() => bus.cleanup())

const user = (name: string, input: Record<string, unknown>) =>
  bus.bus.execute(name, { projectId: bus.projectId, ...input }, { actor: 'user' })
const history = (step: 'undo' | 'redo', variantId: string) =>
  user(`history.${step}`, { scope: `variant:${variantId}` })
// A layer's stored values, without the counters undo moves on.
const values = (l: LayerRow) => ({ ...l, revs: null })
const lastInverse = () => record.mock.calls.at(-1)?.[2] as { name: string; input: unknown }

const BLACK = { style: { color: '#000000' } }
const MOVE = { geometry: { x: 7 } }

describe('layer.update on a linked layer [A-135, A-136]', () => {
  it.each([
    ['style colour at another size', 'tall', 'text', BLACK, ['style.color']],
    ['geometry at another size', 'tall', 'text', MOVE, []],
    ['geometry at the same size', 'same', 'text', MOVE, ['geometry']],
    ['copy in the same language', 'same', 'text', { copy: 'New' }, ['copy']],
    ['copy in another language', 'de', 'text', { copy: 'Neu' }, []],
    ['a name only', 'same', 'text', { name: 'Title' }, []],
    ['the same edit on the master', 'master', 'text', BLACK, []],
    ['an unlinked layer', 'same', 'logo', MOVE, []],
  ])('%s', async (_label, where, which, patch, paths) => {
    const variantId = where === 'master' ? bus.variantId : where
    const key = which === 'text' ? textKey : 'logo'
    const id = where === 'master' ? bus.ids.text : linkedLayerId(where, key)
    const before = values(bus.layer(id))
    expect(await user('layer.update', { layerId: id, patch })).toEqual({
      ok: true,
      data: { layerId: id },
    })
    const after = values(bus.layer(id))
    expect(after.overrides).toEqual(paths)
    expect(after).not.toEqual(before)
    expect(lastInverse().name).toBe(paths.length > 0 ? 'layer.revert' : 'layer.update')

    expect(await history('undo', variantId)).toMatchObject({ ok: true })
    expect(values(bus.layer(id))).toEqual(before)
    expect(await history('redo', variantId)).toMatchObject({ ok: true })
    expect(values(bus.layer(id))).toEqual(after)
  })

  it('adds a path once, in first-added order', async () => {
    const id = linkedLayerId('same', textKey)
    await user('layer.update', { layerId: id, patch: BLACK })
    await user('layer.update', { layerId: id, patch: { copy: 'New' } })
    await user('layer.update', { layerId: id, patch: { style: { color: '#123456' } } })
    expect(bus.layer(id).overrides).toEqual(['style.color', 'copy'])
    expect(lastInverse().name).toBe('layer.update')
  })

  it('bumps variant.rev once and the counters as layer.update does', async () => {
    const id = linkedLayerId('same', textKey)
    const revs = bus.layer(id).revs
    await user('layer.update', { layerId: id, patch: { ...BLACK, ...MOVE } })
    expect(bus.layer(id).revs).toEqual({
      ...revs,
      style: revs.style + 1,
      geometry: revs.geometry + 1,
    })
    expect(bus.layer(id).overrides).toEqual(['geometry', 'style.color'])
  })
})

describe('layer.updateMany on linked layers [A-136]', () => {
  it('adds each layer its paths and puts one layer.revert entry on the list', async () => {
    const text = linkedLayerId('same', textKey)
    const back = linkedLayerId('same', bus.layer(bus.ids.background).key)
    const ids = [text, back]
    const before = ids.map((id) => values(bus.layer(id)))
    const updates = [
      { layerId: text, patch: BLACK },
      { layerId: back, patch: { ...MOVE, name: 'Back' } },
    ]
    const result = await user('layer.updateMany', { variantId: 'same', updates })
    expect(result).toEqual({ ok: true, data: { layerIds: ids } })
    expect(bus.layer(text).overrides).toEqual(['style.color'])
    expect(bus.layer(back).overrides).toEqual(['geometry'])
    expect(record).toHaveBeenCalledTimes(1)
    expect(lastInverse()).toMatchObject({
      name: 'layer.revert',
      input: { variantId: 'same', layers: [{ layerId: text }, { layerId: back }] },
    })
    const after = ids.map((id) => values(bus.layer(id)))

    await history('undo', 'same')
    expect(ids.map((id) => values(bus.layer(id)))).toEqual(before)
    await history('redo', 'same')
    expect(ids.map((id) => values(bus.layer(id)))).toEqual(after)
  })

  it('keeps layer.updateMany as the inverse when no list changes', async () => {
    const id = linkedLayerId('tall', textKey)
    await user('layer.updateMany', { variantId: 'tall', updates: [{ layerId: id, patch: MOVE }] })
    expect(bus.layer(id).overrides).toEqual([])
    expect(lastInverse().name).toBe('layer.updateMany')
  })
})

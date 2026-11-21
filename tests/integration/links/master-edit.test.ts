// P5-3, the named test of the Phase 5 exit (spec/links-and-sync.md, "Overrides"): editing a
// master changes no other variant's layer rows. A direction with a master and three linked
// variants; every layer command on the master leaves the other variants' rows equal, column by
// column, to what they were; only outOfDate changes.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { insertTestAsset } from '../assets/asset-rows'
import { makeLayerBus, type LayerBus } from '../commands/layer-fixture'
import { orderOf } from '../commands/layer-order'
import { addLinkedVariant, layersOf } from './linked-fixture'
import { masterOf } from '@/main/links/master-of'
import { readWireRow } from '@/main/db/rows'
import { variantOutOfDate } from '@/shared/links/out-of-date'
import type { VariantRow } from '@/shared/schemas/rows/variant'

const OTHERS = ['same', 'tall', 'de']
const FADE = { preset: 'fade', startMs: 0, durationMs: 400 }

let bus: LayerBus
let directionId: string
beforeEach(async () => {
  bus = await makeLayerBus()
  directionId = bus.variant().directionId
  insertTestAsset(bus.db, { id: 'pic', relPath: 'p.png', absPath: '/p.png' })
  addLinkedVariant(bus.db, bus.variantId, 'same')
  addLinkedVariant(bus.db, bus.variantId, 'tall', { height: bus.variant().height + 100 })
  addLinkedVariant(bus.db, bus.variantId, 'de', { language: 'de-DE' })
})
afterEach(() => bus.cleanup())

const user = (name: string, input: Record<string, unknown>) =>
  bus.bus.execute(name, { projectId: bus.projectId, ...input }, { actor: 'user' })
const update = (patch: Record<string, unknown>, layerId = bus.ids.text) =>
  user('layer.update', { layerId, patch })

// Every other variant's layer and variant rows, as stored.
const othersAsStored = () => ({
  layers: bus.db
    .prepare(`SELECT * FROM layer WHERE variant_id IN ('same', 'tall', 'de') ORDER BY id`)
    .all(),
  variants: bus.db
    .prepare(`SELECT * FROM variant WHERE id IN ('same', 'tall', 'de') ORDER BY id`)
    .all(),
})

function outOfDate(): Record<string, boolean> {
  const master = masterOf(bus.db, directionId)
  if (!master) throw new Error('The direction has no master.')
  return Object.fromEntries(
    OTHERS.map((id) => {
      const row = readWireRow(bus.db, 'variant', { id }) as VariantRow
      const variant = { row, layers: layersOf(bus.db, id) }
      return [
        id,
        variantOutOfDate({ master: { row: master.variant, layers: master.layers }, variant }),
      ]
    }),
  )
}

const ALL = (value: boolean) => Object.fromEntries(OTHERS.map((id) => [id, value]))
// Out of date where the group follows (or is a translation): every variant but the one whose
// size differs, for geometry.
const BUT_TALL = { same: true, tall: false, de: true }

describe("editing a master changes no other variant's layer rows [Phase 5 exit]", () => {
  it.each([
    ['layer.update of copy', () => update({ copy: 'Fresh' }), ALL(true)],
    ['layer.update of style', () => update({ style: { color: '#000000' } }), ALL(true)],
    ['layer.update of geometry', () => update({ geometry: { x: 9 } }), BUT_TALL],
    [
      'layer.update of source',
      () => update({ source: { assetId: 'pic' } }, bus.ids.image),
      ALL(true),
    ],
    ['layer.update of timing', () => update({ timing: { startMs: 5, endMs: null } }), ALL(true)],
    ['layer.update of animation', () => update({ animation: { entrance: FADE } }), ALL(true)],
    [
      'layer.updateMany',
      () =>
        user('layer.updateMany', {
          variantId: bus.variantId,
          updates: [
            { layerId: bus.ids.text, patch: { copy: 'Both' } },
            { layerId: bus.ids.image, patch: { geometry: { y: 3 } } },
          ],
        }),
      ALL(true),
    ],
    [
      'layer.create',
      () => user('layer.create', { variantId: bus.variantId, type: 'text' }),
      ALL(true),
    ],
    ['layer.delete', () => user('layer.delete', { layerId: bus.ids.image }), ALL(true)],
    [
      'layer.reorder',
      () => user('layer.reorder', { variantId: bus.variantId, layerIds: orderOf(bus).reverse() }),
      ALL(false),
    ],
  ])('%s', async (_label, run, marks) => {
    const before = othersAsStored()
    expect(outOfDate()).toEqual(ALL(false))
    expect(await run()).toMatchObject({ ok: true })
    expect(othersAsStored()).toEqual(before)
    expect(outOfDate()).toEqual(marks)
  })
})

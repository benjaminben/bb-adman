// P5-4 (spec/links-and-sync.md, "Adding back and removing variants", A-141):
// variant.restoreLayers makes a variant's layer set exactly the given rows.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { readLayers } from '@/main/links/snapshot'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { addVariant, makeVariantBus, V2, type VariantBus } from './variant-fixture'

let bus: VariantBus
beforeEach(async () => {
  bus = await makeVariantBus()
})
afterEach(() => bus.cleanup())

const restoreLayers = (variants: Array<{ variantId: string; layers: LayerRow[] }>) =>
  bus.user('variant.restoreLayers', { variants })

// The set to restore: the first layer left out, the second changed, and one new layer.
function wanted(variantId: string): LayerRow[] {
  const [extra, changed, ...rest] = readLayers(bus.db, variantId)
  if (!extra || !changed) throw new Error('too few layers')
  const added = { ...changed, id: `${variantId}-new`, key: 'new', z: 90, name: 'New' }
  return [{ ...changed, name: 'Changed' }, ...rest, added]
}

describe('variant.restoreLayers [system]', () => {
  it('deletes an extra layer, inserts a missing one and rewrites a changed one', async () => {
    addVariant(bus.db, bus.masterId, 'V3', '16x9')
    const before = { V2: readLayers(bus.db, V2), V3: readLayers(bus.db, 'V3') }
    const revs = { V2: bus.variant(V2)?.rev ?? 0, V3: bus.variant('V3')?.rev ?? 0 }
    const input = [
      { variantId: V2, layers: wanted(V2) },
      { variantId: 'V3', layers: wanted('V3') },
    ]
    const result = await bus.changed(() => restoreLayers(input))
    expect(result).toEqual({ ok: true, data: { variantIds: [V2, 'V3'] } })
    const byId = (rows: LayerRow[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id))
    expect(byId(readLayers(bus.db, V2))).toEqual(byId(input[0]?.layers ?? []))
    expect(byId(readLayers(bus.db, 'V3'))).toEqual(byId(input[1]?.layers ?? []))
    expect([bus.variant(V2)?.rev, bus.variant('V3')?.rev]).toEqual([revs.V2 + 1, revs.V3 + 1])
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(readLayers(bus.db, V2)).toEqual(before.V2)
    expect(readLayers(bus.db, 'V3')).toEqual(before.V3)
  })

  it("clears each changed variant's own list", async () => {
    await bus.user('variant.update', { variantId: V2, title: 'New' })
    await restoreLayers([{ variantId: V2, layers: wanted(V2) }])
    expect(bus.undoState(`variant:${V2}`)).toEqual({ canUndo: false, canRedo: false })
    expect(bus.undoState()).toEqual({ canUndo: true, canRedo: false })
  })

  it('refuses a master with master_variant', async () => {
    const layers = readLayers(bus.db, bus.masterId)
    await expectRefused(
      bus,
      () => restoreLayers([{ variantId: bus.masterId, layers }]),
      'RULE_VIOLATION',
      'master_variant',
    )
  })

  it('refuses an unknown variant, a row of another variant and a layer ID used elsewhere', async () => {
    await expectRefused(
      bus,
      () => restoreLayers([{ variantId: 'no-such', layers: [] }]),
      'NOT_FOUND',
    )
    const master = readLayers(bus.db, bus.masterId)
    await expectRefused(
      bus,
      () => restoreLayers([{ variantId: V2, layers: master }]),
      'INVALID_INPUT',
    )
    const moved = master.map((l) => ({ ...l, variantId: V2 }))
    await expectRefused(
      bus,
      () => restoreLayers([{ variantId: V2, layers: moved }]),
      'INVALID_INPUT',
    )
  })

  it('refuses a layer naming an asset no longer in the project', async () => {
    const layers = readLayers(bus.db, V2).map((l) =>
      l.source ? { ...l, source: { assetId: 'gone' } } : l,
    )
    await expectRefused(bus, () => restoreLayers([{ variantId: V2, layers }]), 'NOT_FOUND')
  })

  it('refuses 501 variants at the schema', async () => {
    const variants = Array.from({ length: 501 }, (_, i) => ({ variantId: `V${i}`, layers: [] }))
    await expectRefused(bus, () => restoreLayers(variants), 'INVALID_INPUT')
  })

  it('is denied to the agent without an ask', async () => {
    const result = await bus.agent('variant.restoreLayers', {
      variants: [{ variantId: V2, layers: [] }],
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect(bus.asked).toEqual([])
  })
})

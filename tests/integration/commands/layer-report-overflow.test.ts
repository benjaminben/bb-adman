import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { makeLayerBus, type LayerBus } from './layer-fixture'

let bus: LayerBus
beforeEach(async () => {
  bus = await makeLayerBus()
})
afterEach(() => bus.cleanup())

const ZERO = { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 }
const report = (overflow: boolean, variantRev: number, layerId = bus.ids.text) =>
  bus.user('layer.reportOverflow', { layerId, overflow, variantRev })

describe('layer.reportOverflow [FR-098]', () => {
  it('writes overflow and names the layer, with no rev, counter or undo entry', async () => {
    const result = await bus.changed(() => report(true, 0))
    expect(result).toEqual({ ok: true, data: { applied: true } })
    expect(bus.layer(bus.ids.text)).toMatchObject({ overflow: true, revs: ZERO })
    expect(bus.variant().rev).toBe(0)
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
    expect(await report(false, 0)).toEqual({ ok: true, data: { applied: true } })
    expect(bus.layer(bus.ids.text).overflow).toBe(false)
  })

  it('writes nothing for a measurement of an older drawing', async () => {
    await bus.update(bus.ids.text, { copy: 'Longer text' })
    expect(bus.variant().rev).toBe(1)
    const result = await bus.changed(() => report(true, 0))
    expect(result).toEqual({ ok: true, data: { applied: false } })
    expect(bus.layer(bus.ids.text).overflow).toBe(false)
    expect(await report(true, 1)).toEqual({ ok: true, data: { applied: true } })
  })

  it('writes nothing when the stored overflow already equals the report', async () => {
    const result = await bus.changed(() => report(false, 0))
    expect(result).toEqual({ ok: true, data: { applied: false } })
  })

  it.each<['image' | 'background']>([['image'], ['background']])(
    'refuses a %s layer: only a text layer has text',
    async (which) => {
      const error = await expectRefused(bus, () => report(true, 0, bus.ids[which]), 'INVALID_INPUT')
      expect(error.message).toBe('Only a text layer has text.')
    },
  )

  it('refuses an unknown layer with NOT_FOUND', async () => {
    const error = await expectRefused(bus, () => report(true, 0, 'no-such-layer'), 'NOT_FOUND')
    expect(error.message).toBe('That layer was not found.')
  })

  it.each<Record<string, unknown>>([
    { variantRev: -1 },
    { variantRev: 1.5 },
    { overflow: 'yes' },
    { extra: 1 },
  ])('refuses the input %j with INVALID_INPUT', async (change) => {
    const input = { layerId: bus.ids.text, overflow: true, variantRev: 0, ...change }
    await expectRefused(bus, () => bus.user('layer.reportOverflow', input), 'INVALID_INPUT')
  })
})

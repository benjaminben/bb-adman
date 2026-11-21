// LK-1 (security class): the look fields through layer.update and layer.updateMany
// (spec/editor-commands.md "layer.update", "Look fields"). An outside agent can send them, so
// the schema bounds them and mergeStyle keeps each on its own layer type.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { makeLayerBus, type LayerBus } from './layer-fixture'
import { pictureLookOf, textLookOf } from '@/shared/config/look'
import type { ImageStyle, TextStyle } from '@/shared/schemas/layer'
import type { Actor } from '@/shared/schemas/events'

let bus: LayerBus
beforeEach(async () => {
  bus = await makeLayerBus()
  // Every layer as stored before the look fields existed, whatever the template now stores.
  bus.db
    .prepare(
      `UPDATE layer SET style = json_remove(style, '$.verticalAlign', '$.allCaps', '$.boxColor',
        '$.boxOutlineColor', '$.boxOutlineWidth', '$.boxRadius', '$.boxPadding', '$.fillColor',
        '$.shade')`,
    )
    .run()
})
afterEach(() => bus.cleanup())

type Which = keyof LayerBus['ids']
type Update = { layerId: string; patch: Record<string, unknown> }

const NOT_FIT = 'Those style values do not fit this layer.'
const ZERO = { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 }
const SHADE = { color: '#000000', from: 'bottom', strength: 0.7, reach: 0.6 }
const OTHER_SHADE = { color: '#112233', from: 'all', strength: 0.3, reach: 1 }

const many = (updates: Update[], actor: Actor = 'user') =>
  bus.bus.execute(
    'layer.updateMany',
    { projectId: bus.projectId, variantId: bus.variantId, updates },
    { actor },
  )
const one = (which: Which, style: Record<string, unknown>) => ({
  layerId: bus.ids[which],
  patch: { style },
})
const textLook = () => textLookOf(bus.layer(bus.ids.text).style as TextStyle)
const pictureLook = (which: 'image' | 'background') =>
  pictureLookOf(bus.layer(bus.ids[which]).style as ImageStyle)

describe('layer.update look fields [LK-1, D-094]', () => {
  it.each<[string, Which, Record<string, unknown>]>([
    ['verticalAlign', 'text', { verticalAlign: 'bottom' }],
    ['allCaps', 'text', { allCaps: true }],
    ['boxColor', 'text', { boxColor: '#1A2B3C' }],
    ['boxOutlineColor', 'text', { boxOutlineColor: '#FFFFFF' }],
    ['boxOutlineWidth', 'text', { boxOutlineWidth: 4 }],
    ['boxRadius', 'text', { boxRadius: 2000 }],
    ['boxPadding', 'text', { boxPadding: 24 }],
    ['fillColor on the background', 'background', { fillColor: '#FFD54A' }],
    ['shade on a picture', 'image', { shade: SHADE }],
    ['shade on the background', 'background', { shade: SHADE }],
  ])('%s: saved, read back, revs.style bumped once', async (_, which, style) => {
    const before = bus.layer(bus.ids[which]).style
    const result = await bus.changed(() => bus.update(bus.ids[which], { style }))
    expect(result).toMatchObject({ ok: true })
    const layer = bus.layer(bus.ids[which])
    expect(layer.style).toEqual({ ...before, ...style })
    expect(layer.revs).toEqual({ ...ZERO, style: 1 })
    expect(bus.variant().rev).toBe(1)
  })

  it('bumps revs.style once for many look fields in one patch', async () => {
    const style = { boxColor: '#000000', boxPadding: 10, verticalAlign: 'middle', allCaps: true }
    await bus.update(bus.ids.text, { style })
    expect(bus.layer(bus.ids.text).revs).toEqual({ ...ZERO, style: 1 })
  })

  it.each<[string, Which, Record<string, unknown>]>([
    ['a fillColor on an image layer (A-73)', 'image', { fillColor: '#FFFFFF' }],
    ['a picture field on a text layer', 'text', { fillColor: null }],
    ['a shade on a text layer', 'text', { shade: null }],
    ['a text field on a picture layer', 'image', { boxColor: null }],
    ['a text field on the background', 'background', { allCaps: true }],
  ])('refuses %s', async (_, which, style) => {
    const error = await expectRefused(
      bus,
      () => bus.update(bus.ids[which], { style }),
      'INVALID_INPUT',
    )
    expect(error.message).toBe(NOT_FIT)
  })

  it.each<[string, Record<string, unknown>]>([
    ['a colour that is not #RRGGBB', { boxColor: 'red' }],
    ['a padding past its bound', { boxPadding: 2001 }],
    ['an unknown align', { verticalAlign: 'center' }],
    ['a shade with an unknown key', { shade: { ...SHADE, blur: 2 } }],
  ])('refuses %s by the schema', async (_, style) => {
    await expectRefused(bus, () => bus.update(bus.ids.text, { style }), 'INVALID_INPUT')
  })

  it('replaces the shade whole, and null clears it', async () => {
    const id = bus.ids.image
    await bus.update(id, { style: { shade: SHADE } })
    await bus.update(id, { style: { shade: OTHER_SHADE } })
    expect(pictureLook('image').shade).toEqual(OTHER_SHADE)
    await bus.update(id, { style: { shade: null } })
    expect(bus.layer(id).style).toEqual({ opacity: 1, shade: null })
  })

  it.each<[string, Which, Record<string, unknown>]>([
    ['boxColor null', 'text', { boxColor: null }],
    ['every text default', 'text', textDefaults()],
    ['fillColor null on an image layer', 'image', { fillColor: null }],
    ['shade null on the background', 'background', { shade: null }],
  ])('%s on a row without the fields changes nothing', async (_, which, style) => {
    const before = bus.layer(bus.ids[which])
    expect(await bus.update(bus.ids[which], { style })).toMatchObject({ ok: true })
    expect(bus.layer(bus.ids[which])).toEqual(before)
    expect(bus.variant().rev).toBe(0)
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it('undo puts back the defaults of fields the row lacked', async () => {
    const look = textLook()
    await bus.update(bus.ids.text, { style: { boxColor: '#FFFFFF', verticalAlign: 'middle' } })
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    const style = bus.layer(bus.ids.text).style
    expect(style).toMatchObject({ boxColor: null, verticalAlign: 'top' })
    expect(textLook()).toEqual(look)
  })

  it("accepts the agent's call the same", async () => {
    const result = await bus.update(bus.ids.text, { style: { boxRadius: 8 } }, 'agent')
    expect(result).toMatchObject({ ok: true })
    expect(bus.layer(bus.ids.text).style).toMatchObject({ boxRadius: 8 })
    await expectRefused(
      bus,
      () => bus.update(bus.ids.image, { style: { fillColor: '#FFFFFF' } }, 'agent'),
      'INVALID_INPUT',
    )
  })
})

describe('layer.updateMany look fields [LK-1]', () => {
  it('saves look fields on several layers', async () => {
    await many([one('text', { boxPadding: 12 }), one('background', { fillColor: '#F2F2F5' })])
    expect(textLook().boxPadding).toBe(12)
    expect(pictureLook('background').fillColor).toBe('#F2F2F5')
  })

  it('refuses a fillColor on an image layer, and writes nothing', async () => {
    const run = () =>
      many([one('text', { boxPadding: 12 }), one('image', { fillColor: '#FFFFFF' })])
    const error = await expectRefused(bus, run, 'INVALID_INPUT')
    expect(error.message).toBe(NOT_FIT)
  })

  it('changes nothing for defaults on rows without the fields', async () => {
    const before = [bus.layer(bus.ids.text), bus.layer(bus.ids.image)]
    const result = await many([one('text', { boxColor: null }), one('image', { shade: null })])
    expect(result).toMatchObject({ ok: true, data: { layerIds: [] } })
    expect([bus.layer(bus.ids.text), bus.layer(bus.ids.image)]).toEqual(before)
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it('undo puts back the defaults of fields the rows lacked', async () => {
    const looks = [textLook(), pictureLook('background')]
    await many([
      one('text', { boxColor: '#FFFFFF' }),
      one('background', { fillColor: '#FFD54A', shade: SHADE }),
    ])
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.layer(bus.ids.text).style).toMatchObject({ boxColor: null })
    expect(bus.layer(bus.ids.background).style).toMatchObject({ fillColor: null, shade: null })
    expect([textLook(), pictureLook('background')]).toEqual(looks)
  })
})

function textDefaults() {
  return {
    verticalAlign: 'top',
    allCaps: false,
    boxColor: null,
    boxOutlineColor: null,
    boxOutlineWidth: 0,
    boxRadius: 0,
    boxPadding: 0,
  }
}

import { describe, it, expect } from 'vitest'
import { newLayerValues } from '@/shared/templates/new-layer'
import { LayerRow } from '@/shared/schemas/rows/layer'

const SQUARE = { width: 1080, height: 1080 }
const ZERO = { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 }

describe('newLayerValues [spec/editor-commands.md, layer.create]', () => {
  it('starts a picture layer with the box of any other image slot and no picture', () => {
    expect(newLayerValues('image', SQUARE, 0)).toEqual({
      type: 'image',
      slot: null,
      name: 'Picture 1',
      copy: null,
      style: { opacity: 1, shade: null },
      geometry: { x: 292, y: 292, width: 497, height: 497, rotation: 0, crop: null },
      source: null,
      visible: true,
      locked: false,
      linked: false,
      overrides: [],
      timing: { startMs: 0, endMs: null },
      animation: {
        entrance: { preset: 'none', startMs: 0, durationMs: 0 },
        exit: { preset: 'none', startMs: 0, durationMs: 0 },
      },
      revs: ZERO,
      syncedRevs: ZERO,
      translationStatus: null,
      translationSource: null,
      overflow: false,
    })
  })

  it('starts a text layer with the box and style of any other copy slot', () => {
    const text = newLayerValues('text', SQUARE, 0)
    expect(text).toMatchObject({ type: 'text', slot: null, name: 'Text 1', copy: 'Your text' })
    expect(text.geometry).toEqual({
      x: 65,
      y: 454,
      width: 950,
      height: 173,
      rotation: 0,
      crop: null,
    })
    expect(text.style).toEqual({
      fontAssetId: null,
      fontSize: 76,
      fontWeight: 700,
      color: '#FFFFFF',
      align: 'center',
      lineHeight: 1.1,
      letterSpacing: 0,
      verticalAlign: 'top',
      allCaps: false,
      boxColor: null,
      boxOutlineColor: null,
      boxOutlineWidth: 0,
      boxRadius: 0,
      boxPadding: 0,
    })
  })

  it.each<['image' | 'text', number, string]>([
    ['image', 0, 'Picture 1'],
    ['image', 4, 'Picture 5'],
    ['text', 1, 'Text 2'],
    ['text', 9, 'Text 10'],
  ])('names a %s layer after %i of its type "%s"', (type, count, name) => {
    expect(newLayerValues(type, SQUARE, count).name).toBe(name)
  })

  it.each([
    ['image', 50, 50],
    ['text', 50, 50],
    ['image', 8192, 8192],
    ['text', 8192, 8192],
    ['text', 50, 8192],
    ['image', 8192, 50],
  ] as const)('a %s layer at %ix%i passes LayerRow', (type, width, height) => {
    const values = newLayerValues(type, { width, height }, 0)
    const row = { ...values, id: 'l', variantId: 'v', key: 'layer-x', z: 1 }
    expect(LayerRow.strict().safeParse(row).success).toBe(true)
    expect(values.geometry.width).toBeGreaterThan(0)
    expect(values.geometry.height).toBeGreaterThan(0)
  })

  it('gives fresh values each call', () => {
    const a = newLayerValues('text', SQUARE, 0)
    a.revs.copy = 3
    a.animation.entrance.durationMs = 9
    const b = newLayerValues('text', SQUARE, 0)
    expect(b.revs.copy).toBe(0)
    expect(b.animation.entrance.durationMs).toBe(0)
  })
})

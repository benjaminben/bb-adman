import { describe, expect, it } from 'vitest'
import { planVariant, type PlanInput } from '@/shared/links/fan-out-plan'
import type { Geometry } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { layer } from '../scene/fixtures'

const masterRevs = { copy: 3, style: 2, geometry: 4, source: 1, timing: 0, animation: 5 }
const box = (x: number, y: number, width: number, height: number, rotation = 0): Geometry => ({
  x,
  y,
  width,
  height,
  rotation,
  crop: null,
})

const masterLayers: LayerRow[] = [
  layer({
    id: 'bg',
    type: 'background',
    z: 0,
    source: { assetId: 'a1' },
    geometry: { ...box(0, 0, 1080, 1080), crop: { x: 10, y: 0, width: 900, height: 900 } },
    revs: masterRevs,
  }),
  layer({ id: 'centre', type: 'image', geometry: box(270, 270, 540, 540, 15), revs: masterRevs }),
  layer({ id: 'corner', type: 'text', copy: 'Hello', geometry: box(0, 0, 200, 100) }),
  layer({ id: 'tiny', type: 'image', geometry: box(500, 500, 4, 4) }),
]

const square = { width: 1080, height: 1080, language: 'en-GB' }
const picture = { width: 1600, height: 900 }

function input(over: Partial<PlanInput>): PlanInput {
  return {
    master: square,
    masterLayers,
    target: square,
    fit: 'scale',
    pictureSize: picture,
    sameSizePlan: null,
    ...over,
  }
}

const geometryOf = (key: string, planned: ReturnType<typeof planVariant>) =>
  planned.find((l) => l.key === key)?.geometry

describe('planVariant, other layers at a new size [FR-075]', () => {
  it.each([
    {
      name: '1080×1080 to 1080×1920',
      target: { width: 1080, height: 1920 },
      centre: box(270, 690, 540, 540, 15),
      corner: box(0, 39, 200, 100),
    },
    {
      name: '1080×1080 to 1920×1080',
      target: { width: 1920, height: 1080 },
      centre: box(690, 270, 540, 540, 15),
      corner: box(78, 0, 200, 100),
    },
    {
      name: '1080×1080 to 540×960 scales by the smaller ratio',
      target: { width: 540, height: 960 },
      centre: box(135, 345, 270, 270, 15),
      corner: box(0, 19, 100, 50),
    },
  ])('$name keeps the centre share, whole pixels, rotation kept', ({ target, centre, corner }) => {
    const planned = planVariant(input({ target: { ...target, language: 'en-GB' } }))
    expect(geometryOf('centre', planned)).toEqual(centre)
    expect(geometryOf('corner', planned)).toEqual(corner)
  })

  it('a box never shrinks below 1 pixel', () => {
    const planned = planVariant(input({ target: { width: 108, height: 192, language: 'en-GB' } }))
    expect(geometryOf('tiny', planned)).toEqual(box(50, 89, 1, 1))
  })
})

describe('planVariant, the background at a new size [FR-076]', () => {
  it.each([
    { fit: 'scale' as const, width: 1080, height: 1920, want: box(0, 656, 1080, 608) },
    { fit: 'crop' as const, width: 1080, height: 1920, want: box(-1167, 0, 3413, 1920) },
    { fit: 'fill' as const, width: 1080, height: 1920, want: box(0, 656, 1080, 608) },
    { fit: 'scale' as const, width: 1920, height: 1080, want: box(0, 0, 1920, 1080) },
    { fit: 'crop' as const, width: 1920, height: 1080, want: box(0, 0, 1920, 1080) },
  ])('$fit of a 1600×900 picture on $width×$height', ({ fit, width, height, want }) => {
    const planned = planVariant(input({ fit, target: { width, height, language: 'en-GB' } }))
    expect(geometryOf('bg', planned)).toEqual(want)
  })

  it.each([
    { name: 'an unknown picture size', pictureSize: null, source: { assetId: 'a1' } },
    { name: 'a background with no picture', pictureSize: picture, source: null },
  ])('$name gives the whole canvas', ({ pictureSize, source }) => {
    const layers = masterLayers.map((l) => (l.key === 'bg' ? { ...l, source } : l))
    const planned = planVariant(
      input({
        masterLayers: layers,
        pictureSize,
        fit: 'crop',
        target: { width: 1080, height: 1920, language: 'en-GB' },
      }),
    )
    expect(geometryOf('bg', planned)).toEqual(box(0, 0, 1080, 1920))
  })
})

describe('planVariant at the master size and for languages [R-02]', () => {
  it('same pixels with another label keeps the master geometry (A-147)', () => {
    const planned = planVariant(input({ fit: 'crop' }))
    expect(planned.map((l) => l.geometry)).toEqual(masterLayers.map((l) => l.geometry))
  })

  it('another language at the master size keeps geometry and marks text missing (A-134)', () => {
    const planned = planVariant(input({ target: { ...square, language: 'de-DE' } }))
    expect(planned.map((l) => l.geometry)).toEqual(masterLayers.map((l) => l.geometry))
    const text = planned.find((l) => l.key === 'corner')
    expect(text).toMatchObject({ copy: 'Hello', translationStatus: 'missing' })
    expect(text?.translationSource).toBeNull()
    expect(planned.find((l) => l.key === 'centre')?.translationStatus).toBeNull()
  })

  it('a text layer in the master language keeps its translation fields', () => {
    const planned = planVariant(input({ target: { width: 1080, height: 1920, language: 'en-GB' } }))
    expect(planned.find((l) => l.key === 'corner')).toMatchObject({
      copy: 'Hello',
      translationStatus: null,
      translationSource: null,
    })
  })

  it('another size and language takes geometry from the same-size plan', () => {
    const tall = { width: 1080, height: 1920 }
    const sameSizePlan = planVariant(input({ target: { ...tall, language: 'en-GB' } })).map((l) =>
      l.key === 'centre' ? { ...l, geometry: box(1, 2, 3, 4) } : l,
    )
    const planned = planVariant(input({ target: { ...tall, language: 'de-DE' }, sameSizePlan }))
    expect(planned.map((l) => l.geometry)).toEqual(sameSizePlan.map((l) => l.geometry))
    expect(planned.find((l) => l.key === 'corner')?.translationStatus).toBe('missing')
  })

  it('another size and language with no same-size plan works the geometry out the same way', () => {
    const tall = { width: 1080, height: 1920 }
    const own = planVariant(input({ target: { ...tall, language: 'en-GB' } }))
    const planned = planVariant(input({ target: { ...tall, language: 'de-DE' } }))
    expect(planned.map((l) => l.geometry)).toEqual(own.map((l) => l.geometry))
  })
})

describe('planVariant, the link fields', () => {
  const planned = planVariant(input({ target: { width: 1920, height: 1080, language: 'de-DE' } }))

  it('copies every master layer in order, linked, with no overrides and no IDs', () => {
    expect(planned.map((l) => l.key)).toEqual(['bg', 'centre', 'corner', 'tiny'])
    for (const l of planned) {
      expect(l).toMatchObject({ linked: true, overrides: [], overflow: false })
      expect(l).not.toHaveProperty('id')
      expect(l).not.toHaveProperty('variantId')
    }
  })

  it('sets synced_revs to the master layer revs and starts its own revs at 0', () => {
    expect(planned.map((l) => l.syncedRevs)).toEqual(masterLayers.map((l) => l.revs))
    for (const l of planned) {
      expect(l.revs).toEqual({ copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 })
    }
  })

  it('keeps the other master values', () => {
    const kept = (l: (typeof planned)[number] | LayerRow) => {
      const { type, slot, name, z, visible, locked, style, source, timing, animation } = l
      return { type, slot, name, z, visible, locked, style, source, timing, animation }
    }
    expect(planned.map(kept)).toEqual(masterLayers.map(kept))
  })

  it('does not change its input, and shares no object with it', () => {
    const before = structuredClone(masterLayers)
    const [first] = planVariant(input({}))
    expect(masterLayers).toEqual(before)
    if (!first) throw new Error('no layers planned')
    first.geometry.x = 999
    first.syncedRevs.copy = 999
    first.animation.entrance.startMs = 999
    expect(masterLayers).toEqual(before)
  })
})

// spec/make-variants.md "Where a box goes in a new size": a box the source's starter layout
// placed takes that layout's box at the new size; any other box is anchored.
import { describe, expect, it } from 'vitest'
import { planVariant, type PlanInput, type PlannedLayer } from '@/shared/links/fan-out-plan'
import { layoutBoxOf } from '@/shared/links/source-layout'
import { buildMasterLayers } from '@/shared/templates/master-layers'
import { starterTemplate } from '@/shared/templates/starter'
import { DEFAULT_STARTER_LAYOUT, type StarterLayout } from '@/shared/config/default-layout'
import { starterLayoutOf } from '@/shared/config/starter-layouts'
import type { Geometry } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { SlotFills } from '@/shared/templates/types'

const FILLS: SlotFills = {
  background: { assetId: 'asset-bg' },
  'subject-image': { assetId: 'asset-subject' },
  logo: { assetId: 'asset-logo' },
  headline: { text: 'Fresh for summer' },
  'call-to-action': { text: 'Shop now' },
}
const SQUARE = { width: 1080, height: 1080, language: 'en' }
const WIDE = { width: 1920, height: 1080, language: 'en' }
const TALL = { width: 1080, height: 1920, language: 'en' }
const PICTURE = { width: 1600, height: 900 }
const BOXES = ['logo', 'headline', 'call-to-action'] as const

const box = (x: number, y: number, width: number, height: number): Geometry => ({
  x,
  y,
  width,
  height,
  rotation: 0,
  crop: null,
})

const layoutNamed = (id: string): StarterLayout => {
  const layout = starterLayoutOf(id)
  if (!layout) throw new Error(`no layout ${id}`)
  return layout
}

const masterOf = (layout: StarterLayout): LayerRow[] =>
  buildMasterLayers(starterTemplate, { label: '1x1', ...SQUARE }, FILLS, layout).map((l) => ({
    ...l,
    id: `m-${l.key}`,
    variantId: 'm',
  }))

const withGeometry = (layers: LayerRow[], key: string, change: Partial<Geometry>) =>
  layers.map((l) => (l.key === key ? { ...l, geometry: { ...l.geometry, ...change } } : l))

const input = (masterLayers: LayerRow[], over: Partial<PlanInput>): PlanInput => ({
  master: SQUARE,
  masterLayers,
  target: SQUARE,
  fit: 'scale',
  pictureSize: PICTURE,
  sameSizePlan: null,
  ...over,
})

const at = (planned: PlannedLayer[], key: string) => planned.find((l) => l.key === key)?.geometry

describe('planVariant, a box the layout placed [MV-3]', () => {
  const layout = DEFAULT_STARTER_LAYOUT

  it.each([
    { name: '1920 × 1080', target: WIDE },
    { name: '1080 × 1920', target: TALL },
  ])('a photo-bottom-left master to $name takes the layout box', ({ target }) => {
    const planned = planVariant(input(masterOf(layout), { target }))
    for (const key of BOXES) {
      expect(at(planned, key)).toEqual(layoutBoxOf(layout, { key }, target))
      expect(at(planned, key)?.x).toBe(65)
    }
  })

  it('a moved logo is anchored while the other boxes follow the layout', () => {
    const master = withGeometry(masterOf(layout), 'logo', { x: 80, y: 80 })
    const planned = planVariant(input(master, { target: WIDE }))
    expect(at(planned, 'logo')).toEqual(box(80, 80, 151, 151))
    expect(at(planned, 'headline')).toEqual(layoutBoxOf(layout, { key: 'headline' }, WIDE))
  })

  it("keeps the layer's crop on a layout box", () => {
    const crop = { x: 1, y: 2, width: 3, height: 4 }
    const planned = planVariant(
      input(withGeometry(masterOf(layout), 'logo', { crop }), {
        target: TALL,
      }),
    )
    expect(at(planned, 'logo')).toEqual({ ...layoutBoxOf(layout, { key: 'logo' }, TALL), crop })
  })

  it('places the background by the fit, as before', () => {
    const planned = planVariant(input(masterOf(layout), { target: TALL }))
    expect(at(planned, 'background')).toEqual(box(0, 656, 1080, 608))
  })

  it('a new size in a new language copies the same-size plan (R-02)', () => {
    const master = masterOf(layout)
    const sameSizePlan = planVariant(input(master, { target: TALL })).map((l) =>
      l.key === 'headline' ? { ...l, geometry: box(1, 2, 3, 4) } : l,
    )
    const planned = planVariant(
      input(master, { target: { ...TALL, language: 'de' }, sameSizePlan }),
    )
    expect(planned.map((l) => l.geometry)).toEqual(sameSizePlan.map((l) => l.geometry))
  })
})

describe('planVariant, the layout ID breaks a tie [MV-3]', () => {
  const top = layoutNamed('photo-top-centre')
  // The logo sits in the default layout, the headline in photo-top-centre: a tie.
  const master = masterOf(DEFAULT_STARTER_LAYOUT)
    .map((l) => (l.key === 'headline' ? (masterOf(top).find((t) => t.key === 'headline') ?? l) : l))
    .filter((l) => l.key === 'background' || l.key === 'logo' || l.key === 'headline')

  it('the named layout wins the tie', () => {
    const planned = planVariant(input(master, { target: TALL, layoutId: top.id }))
    expect(at(planned, 'headline')).toEqual(layoutBoxOf(top, { key: 'headline' }, TALL))
  })

  it.each([undefined, null])('with layout ID %s the default layout wins it', (layoutId) => {
    const planned = planVariant(input(master, { target: TALL, layoutId }))
    expect(at(planned, 'headline')).toEqual(box(65, 86, 950, 259))
  })
})

describe('planVariant, boxes no layout placed: the worked values [MV-3]', () => {
  const master = withGeometry(
    withGeometry(
      withGeometry(masterOf(DEFAULT_STARTER_LAYOUT), 'logo', box(80, 80, 151, 151)),
      'headline',
      box(80, 640, 920, 260),
    ),
    'call-to-action',
    box(80, 900, 454, 97),
  ).filter((l) => l.key !== 'subject-image')

  it.each([
    { target: WIDE, want: [box(80, 80, 151, 151), box(80, 640, 1760, 260), box(80, 900, 454, 97)] },
    {
      target: TALL,
      want: [box(80, 80, 151, 151), box(80, 1480, 920, 260), box(80, 1740, 454, 97)],
    },
    {
      target: { width: 300, height: 250, language: 'en' },
      want: [box(19, 19, 35, 35), box(19, 148, 262, 60), box(19, 209, 105, 22)],
    },
  ])('at $target.width × $target.height', ({ target, want }) => {
    const planned = planVariant(input(master, { target }))
    expect(BOXES.map((key) => at(planned, key))).toEqual(want)
  })

  it('the same pixel size keeps geometry', () => {
    const planned = planVariant(input(master, { target: { ...SQUARE, language: 'de' } }))
    expect(planned.map((l) => l.geometry)).toEqual(master.map((l) => l.geometry))
  })
})

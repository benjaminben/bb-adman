// P5-10 (spec/links-and-sync.md, "Fan-out"): variant.fanOut makes the missing variants of a
// direction from its master, skips what exists, and undoes with variant.remove.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { SQUARE, TALL } from '../campaigns/campaign-fixture'
import { makeFanOutBus, WIDE, type FanOutBus } from './fan-out-fixture'
import type { LayerRow } from '@/shared/schemas/rows/layer'

let bus: FanOutBus
beforeEach(async () => {
  bus = await makeFanOutBus()
})
afterEach(() => bus.cleanup())

const ALL = {
  sizes: [SQUARE.label, TALL.label, WIDE.label],
  languages: ['en', 'de'],
  formats: ['image'],
  fits: { [TALL.label]: 'scale', [WIDE.label]: 'crop' },
}
const fanOut = (over: Record<string, unknown> = {}) =>
  bus.user('variant.fanOut', { directionId: bus.directionId, ...ALL, ...over })
const ORDER = [
  [SQUARE.label, 'de'],
  [TALL.label, 'en'],
  [TALL.label, 'de'],
  [WIDE.label, 'en'],
  [WIDE.label, 'de'],
] as const

const background = (layers: LayerRow[]) => layers.find((l) => l.type === 'background')
const byKey = (layers: LayerRow[]) => Object.fromEntries(layers.map((l) => [l.key, l]))

describe('variant.fanOut [P5-10]', () => {
  it('makes five linked variants from a 1080x1080 master at three sizes and two languages', async () => {
    const result = await bus.changed(() => fanOut())
    const ids = ORDER.map(([size, language]) => bus.at(size, language)?.id)
    expect(result).toEqual({ ok: true, data: { variantIds: ids, fill: [] } })
    expect(bus.variants()).toHaveLength(5)
    const master = bus.master()
    const masterLayers = bus.layers(bus.masterId)
    for (const id of ids) {
      const v = bus.variants().find((x) => x.id === id)
      expect(v).toMatchObject({ title: master.title, rev: 0, createdBy: 'user', format: 'image' })
      expect(bus.subjects(id ?? '')).toEqual(bus.subjects(bus.masterId))
      const layers = bus.layers(id ?? '')
      expect(layers.map((l) => l.key).sort()).toEqual(masterLayers.map((l) => l.key).sort())
      const masters = byKey(masterLayers)
      for (const l of layers) {
        expect(l).toMatchObject({ linked: true, overrides: [], overflow: false })
        expect(l.syncedRevs).toEqual(masters[l.key]?.revs)
      }
    }
  })

  it('places the background by scale and crop, and keeps the master copy marked missing in a new language', async () => {
    await fanOut()
    const tall = bus.layers(bus.at(TALL.label, 'en')?.id ?? '')
    const wide = bus.layers(bus.at(WIDE.label, 'en')?.id ?? '')
    expect(background(tall)?.geometry).toEqual({
      x: 0,
      y: 420,
      width: 1080,
      height: 1080,
      rotation: 0,
      crop: null,
    })
    expect(background(wide)?.geometry).toEqual({
      x: 0,
      y: -420,
      width: 1920,
      height: 1920,
      rotation: 0,
      crop: null,
    })
    const masterText = bus.layers(bus.masterId).filter((l) => l.type === 'text')
    expect(masterText.length).toBeGreaterThan(0)
    const de = byKey(bus.layers(bus.at(SQUARE.label, 'de')?.id ?? ''))
    for (const t of masterText) {
      expect(de[t.key]).toMatchObject({
        copy: t.copy,
        geometry: t.geometry,
        translationStatus: 'missing',
        translationSource: null,
      })
    }
  })

  it('gives a new size in a new language the geometry of the same size in the master language [R-02]', async () => {
    await fanOut()
    for (const size of [TALL.label, WIDE.label]) {
      const en = byKey(bus.layers(bus.at(size, 'en')?.id ?? ''))
      for (const l of bus.layers(bus.at(size, 'de')?.id ?? '')) {
        expect(l.geometry).toEqual(en[l.key]?.geometry)
      }
    }
  })

  it('skips combinations that exist: a second identical call makes nothing', async () => {
    await fanOut()
    const result = await bus.changed(() => fanOut())
    expect(result).toEqual({ ok: true, data: { variantIds: [], fill: [] } })
    expect(bus.variants()).toHaveLength(5)
  })

  it('places a fill size as scale and names its master-language variant in fill [A-129]', async () => {
    const result = await fanOut({ fits: { [TALL.label]: 'fill', [WIDE.label]: 'scale' } })
    const tallEn = bus.at(TALL.label, 'en')?.id
    expect(result).toMatchObject({
      ok: true,
      data: { fill: [{ sizeLabel: TALL.label, variantId: tallEn }] },
    })
    expect(background(bus.layers(tallEn ?? ''))?.geometry).toMatchObject({
      x: 0,
      y: 420,
      width: 1080,
      height: 1080,
    })
    expect(bus.db.prepare('SELECT COUNT(*) AS n FROM job').get()).toEqual({ n: 0 })
  })

  it('undo removes all five, redo brings them back with their IDs', async () => {
    const result = (await fanOut()) as { data: { variantIds: string[] } }
    const ids = result.data.variantIds
    const layerIds = ids.flatMap((id) => bus.layers(id).map((l) => l.id)).sort()
    expect(await bus.changed(() => bus.history('undo'))).toMatchObject({ ok: true })
    expect(bus.variants()).toEqual([])
    expect(await bus.changed(() => bus.history('redo'))).toMatchObject({ ok: true })
    expect(
      bus
        .variants()
        .map((v) => v.id)
        .sort(),
    ).toEqual([...ids].sort())
    expect(ids.flatMap((id) => bus.layers(id).map((l) => l.id)).sort()).toEqual(layerIds)
  })
})

describe('variant.fanOut refusals [P5-10]', () => {
  const FITS = 'Choose how the background fits for each new size.'
  it.each([
    ['a size not in the campaign', { sizes: ['4x5'] }, 'RULE_VIOLATION', 'not_in_campaign'],
    ['a language not in the campaign', { languages: ['fr'] }, 'RULE_VIOLATION', 'not_in_campaign'],
    ['a missing fits entry', { fits: { [TALL.label]: 'scale' } }, 'INVALID_INPUT', undefined],
    [
      'an extra fits entry',
      { fits: { ...ALL.fits, [SQUARE.label]: 'scale' } },
      'INVALID_INPUT',
      undefined,
    ],
  ])('refuses %s', async (_name, over, code, reason) => {
    const error = await expectRefused(bus, () => fanOut(over), code, reason)
    expect(error.message).toBe(
      code === 'INVALID_INPUT' ? FITS : "Choose sizes and languages from the campaign's lists.",
    )
  })

  it('refuses an unknown direction with NOT_FOUND', async () => {
    await expectRefused(bus, () => fanOut({ directionId: 'D-none' }), 'NOT_FOUND')
  })

  it('refuses 201 new variants with too_many_variants', async () => {
    const sizes = Array.from({ length: 100 }, (_, i) => ({
      label: `${200 + i}x100`,
      width: 200 + i,
      height: 100,
    }))
    bus.db
      .prepare('UPDATE campaign SET sizes = ? WHERE id = ?')
      .run(JSON.stringify([SQUARE, ...sizes]), bus.campaignId)
    const labels = sizes.map((s) => s.label)
    const fits = Object.fromEntries(labels.map((l) => [l, 'scale']))
    const error = await expectRefused(
      bus,
      () => fanOut({ sizes: labels, fits }),
      'RULE_VIOLATION',
      'too_many_variants',
    )
    expect(error.message).toBe('You can make at most 200 variants at a time.')
  })

  it('is denied to the agent', async () => {
    const result = await bus.agent('variant.fanOut', { directionId: bus.directionId, ...ALL })
    expect(result).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect(bus.variants()).toEqual([])
  })
})

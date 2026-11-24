// spec/make-variants.md "Links after making": a new variant made from a variant takes the
// source's layers, values, synced counters and override paths, group by group.
import { describe, expect, it } from 'vitest'
import { planVariant, type PlanInput, type PlannedLayer } from '@/shared/links/fan-out-plan'
import { anchoredBox } from '@/shared/links/place-box'
import { variantOutOfDate } from '@/shared/links/out-of-date'
import type { Geometry, Revs } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { layer, textStyle } from '../scene/fixtures'

const revs = (copy: number, style: number, geometry: number, timing = 0, animation = 0): Revs => ({
  copy,
  style,
  geometry,
  source: 0,
  timing,
  animation,
})
const box = (x: number, y: number, width: number, height: number): Geometry => ({
  x,
  y,
  width,
  height,
  rotation: 0,
  crop: null,
})

const MASTER = { width: 1080, height: 1080, language: 'en' }
const SQUARE_DE = { width: 1080, height: 1080, language: 'de' }
const TALL_EN = { width: 1080, height: 1920, language: 'en' }
const TALL_DE = { width: 1080, height: 1920, language: 'de' }
const WIDE_DE = { width: 1920, height: 1080, language: 'de' }
const WIDE_EN = { width: 1920, height: 1080, language: 'en' }
const WIDE_FR = { width: 1920, height: 1080, language: 'fr' }

const mTitle = layer({
  id: 'm-title',
  type: 'text',
  key: 'title',
  slot: 'headline',
  name: 'Title',
  variantId: 'm',
  copy: 'Hello',
  geometry: box(100, 100, 500, 100),
  revs: revs(3, 4, 5, 2, 1),
})
const mLogo = layer({ id: 'm-logo', type: 'image', key: 'logo', variantId: 'm', z: 2 })
const MASTER_LAYERS = [mTitle, mLogo]

// A linked title on a source, with its own changes in every group.
const sTitle = (over: Partial<LayerRow> = {}) =>
  layer({
    id: 's-title',
    type: 'text',
    key: 'title',
    slot: 'headline',
    name: 'Headline here',
    variantId: 's',
    z: 7,
    linked: true,
    copy: 'Hallo',
    style: { ...textStyle, color: '#00AA00' },
    geometry: box(100, 900, 500, 100),
    timing: { startMs: 500, endMs: null },
    overrides: ['style.color', 'geometry', 'copy', 'timing'],
    revs: revs(9, 9, 9, 9, 9),
    syncedRevs: revs(2, 3, 1, 2, 1),
    translationStatus: 'approved',
    translationSource: 'user',
    ...over,
  })
const sNote = layer({
  id: 's-note',
  type: 'text',
  key: 'note',
  name: 'Note',
  variantId: 's',
  z: 3,
  linked: false,
  copy: 'Nur hier',
  overrides: [],
})

const plan = (
  facts: PlanInput['target'],
  target: PlanInput['target'],
  layers: LayerRow[],
  over: Partial<PlanInput> = {},
): PlannedLayer[] =>
  planVariant({
    master: MASTER,
    masterLayers: MASTER_LAYERS,
    target,
    pictureSize: null,
    source: { facts, layers },
    ...over,
  })
const titleOf = (planned: PlannedLayer[]) => planned.find((l) => l.key === 'title')

describe('planVariant from a source, "Links after making" [MV-4]', () => {
  it('style, source, timing, animation: the source values, counters and paths', () => {
    const t = titleOf(plan(TALL_DE, WIDE_EN, [sTitle()]))
    expect(t?.style).toEqual(sTitle().style)
    expect(t?.timing).toEqual({ startMs: 500, endMs: null })
    expect(t?.syncedRevs).toMatchObject({ style: 3, source: 0, timing: 2, animation: 1 })
    expect(t?.overrides).toEqual(['style.color', 'timing'])
    expect(t?.revs).toEqual(revs(0, 0, 0))
    expect(t?.linked).toBe(true)
    expect(t?.overflow).toBe(false)
  })

  it("geometry at the master's size, the source too: the source's box, counter and path", () => {
    const source = sTitle({ geometry: box(40, 40, 300, 80) })
    const t = titleOf(plan(SQUARE_DE, MASTER, [source]))
    expect(t?.geometry).toEqual(box(40, 40, 300, 80))
    expect(t?.syncedRevs.geometry).toBe(1)
    expect(t?.overrides).toContain('geometry')
  })

  it("geometry at the master's size, the source not: the master's box and counter, no path", () => {
    const t = titleOf(plan(TALL_DE, { ...MASTER, language: 'de' }, [sTitle()]))
    expect(t?.geometry).toEqual(mTitle.geometry)
    expect(t?.syncedRevs.geometry).toBe(5)
    expect(t?.overrides).not.toContain('geometry')
  })

  it("geometry at another size: placed from the source's box and size, no path", () => {
    const t = titleOf(plan(TALL_DE, WIDE_DE, [sTitle()]))
    expect(t?.geometry).toEqual(anchoredBox(sTitle().geometry, TALL_DE, WIDE_DE, true))
    expect(t?.overrides).not.toContain('geometry')
  })

  it("copy in the source's language: the source's words, status, counter and path", () => {
    const t = titleOf(plan(TALL_DE, WIDE_DE, [sTitle()]))
    expect(t).toMatchObject({ copy: 'Hallo', translationStatus: 'approved' })
    expect(t?.translationSource).toBe('user')
    expect(t?.syncedRevs.copy).toBe(2)
    expect(t?.overrides).toContain('copy')
  })

  it("copy in the master's language from a source in another: the master's words, no path", () => {
    const t = titleOf(plan(TALL_DE, WIDE_EN, [sTitle()]))
    expect(t).toMatchObject({ copy: 'Hello', translationStatus: null, translationSource: null })
    expect(t?.syncedRevs.copy).toBe(3)
    expect(t?.overrides).not.toContain('copy')
  })

  it("copy in a third language: the master's words, missing, the master's counter", () => {
    const t = titleOf(plan(TALL_DE, WIDE_FR, [sTitle()]))
    expect(t).toMatchObject({ copy: 'Hello', translationStatus: 'missing' })
    expect(t?.translationSource).toBeNull()
    expect(t?.syncedRevs.copy).toBe(3)
    expect(t?.overrides).not.toContain('copy')
  })
})

describe('planVariant from a source, staleness and layers [MV-4]', () => {
  const outOfDate = (facts: typeof TALL_DE, layers: Array<Omit<LayerRow, 'id' | 'variantId'>>) =>
    variantOutOfDate({
      master: { row: { id: 'm', ...MASTER }, layers: MASTER_LAYERS.slice(0, 1) },
      variant: {
        row: { id: 'x', ...facts },
        layers: layers.map((l) => ({ ...l, id: `x-${l.key}` })),
      },
    })

  it('a stale group stays stale; a fresh source gives a fresh variant', () => {
    expect(outOfDate(TALL_DE, [sTitle()])).toBe(true)
    expect(outOfDate(WIDE_DE, plan(TALL_DE, WIDE_DE, [sTitle()]))).toBe(true)
    const fresh = sTitle({ syncedRevs: revs(3, 4, 1, 2, 1) })
    expect(outOfDate(TALL_DE, [fresh])).toBe(false)
    expect(outOfDate(WIDE_DE, plan(TALL_DE, WIDE_DE, [fresh]))).toBe(false)
  })

  it('an unlinked layer is copied with linked 0 and its own values', () => {
    const note = plan(TALL_DE, WIDE_DE, [sTitle(), sNote]).find((l) => l.key === 'note')
    expect(note).toMatchObject({ linked: false, copy: 'Nur hier', overrides: [], z: 3 })
    expect(note?.translationStatus).toBeNull()
  })

  it('an unlinked layer in another language keeps its words with status missing', () => {
    for (const target of [WIDE_EN, WIDE_FR]) {
      const note = plan(TALL_DE, target, [sNote]).find((l) => l.key === 'note')
      expect(note).toMatchObject({ linked: false, copy: 'Nur hier', translationStatus: 'missing' })
    }
  })

  it("keeps the source's order, name, z, and a hidden and a locked layer stay so", () => {
    const title = sTitle({ visible: false, locked: true })
    const planned = plan(TALL_DE, WIDE_DE, [sNote, title])
    expect(planned.map((l) => l.key)).toEqual(['note', 'title'])
    expect(titleOf(planned)).toMatchObject({
      name: 'Headline here',
      z: 7,
      visible: false,
      locked: true,
    })
  })

  it('a master layer the source lacks is not added', () => {
    expect(plan(TALL_DE, WIDE_DE, [sTitle()]).map((l) => l.key)).toEqual(['title'])
  })

  it("R-02: a new size in another language takes the same-size plan in the source's language", () => {
    const sameSizePlan = plan(TALL_DE, WIDE_DE, [sTitle()])
    const moved = sameSizePlan.map((l) => ({ ...l, geometry: box(1, 2, 3, 4) }))
    const t = titleOf(plan(TALL_DE, WIDE_FR, [sTitle()], { sameSizePlan: moved }))
    expect(t?.geometry).toEqual(box(1, 2, 3, 4))
    const own = titleOf(plan(TALL_DE, WIDE_DE, [sTitle()], { sameSizePlan: moved }))
    expect(own?.geometry).toEqual(titleOf(sameSizePlan)?.geometry)
  })

  it('with no source the result is the master-only plan', () => {
    const planned = planVariant({
      master: MASTER,
      masterLayers: MASTER_LAYERS,
      target: TALL_EN,
      pictureSize: null,
    })
    expect(planned.map((l) => l.key)).toEqual(['title', 'logo'])
    for (const [i, l] of planned.entries()) {
      const from = MASTER_LAYERS[i] as LayerRow
      expect(l).toMatchObject({ linked: true, overrides: [], syncedRevs: from.revs })
      expect(l).toMatchObject({ copy: from.copy, style: from.style, z: from.z })
    }
  })
})

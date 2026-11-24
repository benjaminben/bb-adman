// MV-7 (spec/make-variants.md, "Making variants from a variant", "Links after making",
// "Security"): variant.fanOut with sourceVariantId makes the new variants from a variant of the
// direction, in place of its master.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { createInput, SQUARE, TALL } from '../campaigns/campaign-fixture'
import { makeFanOutBus, WIDE, type FanOutBus } from './fan-out-fixture'
import { copyRow } from './linked-fixture'
import type { LayerRow } from '@/shared/schemas/rows/layer'

let bus: FanOutBus
beforeEach(async () => {
  bus = await makeFanOutBus()
})
afterEach(() => bus.cleanup())

const NOT_HERE = 'That variant was not found in this direction.'
const idAt = (size: string, language: string) => bus.at(size, language)?.id ?? ''
const byKey = (layers: LayerRow[]) => Object.fromEntries(layers.map((l) => [l.key, l]))
const fanOut = (sourceVariantId: string, over: Record<string, unknown> = {}) =>
  bus.user('variant.fanOut', {
    directionId: bus.directionId,
    sourceVariantId,
    sizes: [WIDE.label],
    languages: ['en'],
    formats: ['image'],
    fits: { [WIDE.label]: 'crop' },
    ...over,
  })

// A 9x16 variant in de, made from the master; the source of most tests here.
async function tallDe(): Promise<string> {
  const input = { directionId: bus.directionId, sizeLabel: TALL.label, language: 'de' }
  expect(await bus.user('variant.add', { ...input, format: 'image' })).toMatchObject({ ok: true })
  return idAt(TALL.label, 'de')
}

describe('variant.fanOut from a variant: the source is checked first [MV-7]', () => {
  it('refuses a variant of another direction and campaign with NOT_FOUND, writing nothing', async () => {
    const subjectMap = ['can', 'bottle'].map((subjectId) => ({ subjectId, create: false }))
    const input = { ...createInput(), subjectMap, sizes: [SQUARE, TALL, WIDE] }
    expect(await bus.user('campaign.create', input)).toMatchObject({ ok: true })
    const other = bus.db
      .prepare('SELECT master_variant_id AS id FROM direction WHERE id != ?')
      .get(bus.directionId) as { id: string }
    const error = await expectRefused(bus, () => fanOut(other.id), 'NOT_FOUND')
    expect(error.message).toBe(NOT_HERE)
  })

  it('refuses an ID from another project file with NOT_FOUND, writing nothing', async () => {
    const second = await makeFanOutBus()
    try {
      const error = await expectRefused(bus, () => fanOut(second.masterId), 'NOT_FOUND')
      expect(error.message).toBe(NOT_HERE)
    } finally {
      second.cleanup()
    }
  })

  it('denies an agent before the source is looked up', async () => {
    const result = await bus.agent('variant.fanOut', {
      directionId: bus.directionId,
      sourceVariantId: 'no-such-variant',
      sizes: [WIDE.label],
      languages: ['en'],
      formats: ['image'],
      fits: { [WIDE.label]: 'crop' },
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect(bus.variants()).toEqual([])
  })
})

describe('variant.fanOut from a variant: the grid [MV-7]', () => {
  it("always holds the source's size and language, in place of the master's", async () => {
    const source = await tallDe()
    const result = await fanOut(source)
    const made = [idAt(TALL.label, 'en'), idAt(WIDE.label, 'de'), idAt(WIDE.label, 'en')]
    expect(result).toEqual({ ok: true, data: { variantIds: made, fill: [] } })
    expect(bus.at(SQUARE.label, 'de')).toBeUndefined()
  })

  it("judges fits against the source's pixel size", async () => {
    const source = await tallDe()
    const sizes = [SQUARE.label, TALL.label]
    const fits = { [SQUARE.label]: 'scale', [TALL.label]: 'scale' }
    await expectRefused(bus, () => fanOut(source, { sizes, fits }), 'INVALID_INPUT')
    await expectRefused(bus, () => fanOut(source, { sizes, fits: {} }), 'INVALID_INPUT')
    const ok = await fanOut(source, { sizes, fits: { [SQUARE.label]: 'fill' } })
    expect(ok).toMatchObject({ ok: true, data: { fill: [{ sizeLabel: SQUARE.label }] } })
    expect((ok as { data: { fill: Array<{ variantId: string }> } }).data.fill[0]?.variantId).toBe(
      idAt(SQUARE.label, 'de'),
    )
  })

  it('skips a cell that exists and leaves it unchanged', async () => {
    const source = await tallDe()
    await bus.user('variant.add', {
      directionId: bus.directionId,
      sizeLabel: TALL.label,
      language: 'en',
      format: 'image',
    })
    const before = { variant: bus.at(TALL.label, 'en'), layers: bus.layers(idAt(TALL.label, 'en')) }
    const result = await fanOut(source, { sizes: [TALL.label], fits: {} })
    expect(result).toEqual({ ok: true, data: { variantIds: [], fill: [] } })
    expect(bus.at(TALL.label, 'en')).toEqual(before.variant)
    expect(bus.layers(idAt(TALL.label, 'en'))).toEqual(before.layers)
  })

  it('gives a new size in another language the geometry of that size in the source language [R-02]', async () => {
    const source = await tallDe()
    await fanOut(source)
    const de = byKey(bus.layers(idAt(WIDE.label, 'de')))
    for (const l of bus.layers(idAt(WIDE.label, 'en'))) {
      expect(l.geometry).toEqual(de[l.key]?.geometry)
    }
  })
})

describe('variant.fanOut from a variant: what the new variants take [MV-7]', () => {
  // The source's headline holds its own words and size; it has one layer made on it.
  async function changedSource(): Promise<string> {
    const source = await tallDe()
    const headline = byKey(bus.layers(source)).headline as LayerRow
    const style = JSON.stringify({ ...headline.style, fontSize: 40 })
    bus.db
      .prepare(
        `UPDATE layer SET copy = 'Sommer', translation_status = 'approved',
         translation_source = 'user', style = ?, overrides = '["copy","style.fontSize"]'
         WHERE id = ?`,
      )
      .run(style, headline.id)
    copyRow(bus.db, 'layer', headline.id, { id: 'extra', key: 'extra', z: 99, linked: 0 })
    bus.db.prepare("UPDATE layer SET copy = 'Nur heute', overrides = '[]' WHERE id = 'extra'").run()
    bus.db
      .prepare(
        `UPDATE variant SET title = 'Source title', duration_ms = 9000, duration_overridden = 1
         WHERE id = ?`,
      )
      .run(source)
    bus.db
      .prepare("DELETE FROM variant_subject WHERE variant_id = ? AND subject_id != 'can'")
      .run(source)
    return source
  }

  it('takes the title, subjects, duration and duration flag of the source', async () => {
    const source = await changedSource()
    await fanOut(source)
    for (const id of [idAt(WIDE.label, 'de'), idAt(WIDE.label, 'en')]) {
      const v = bus.variants().find((x) => x.id === id)
      expect(v).toMatchObject({ title: 'Source title', durationMs: 9000, durationOverridden: true })
      expect(bus.subjects(id)).toEqual(['can'])
    }
  })

  it("keeps the source's words and paths in its language, linked to the master", async () => {
    const source = await changedSource()
    await fanOut(source)
    const layers = bus.layers(idAt(WIDE.label, 'de'))
    const keysByZ = (ls: LayerRow[]) => [...ls].sort((a, b) => a.z - b.z).map((l) => l.key)
    expect(keysByZ(layers)).toEqual(keysByZ(bus.layers(source)))
    const { headline, extra } = byKey(layers)
    expect(headline).toMatchObject({ linked: true, copy: 'Sommer', translationStatus: 'approved' })
    expect(headline?.overrides).toEqual(expect.arrayContaining(['copy', 'style.fontSize']))
    expect(headline?.overrides).not.toContain('geometry')
    expect(extra).toMatchObject({ linked: false, overrides: [], copy: 'Nur heute' })
  })

  it("takes the master's words in the master's language and keeps an unlinked layer's words, missing", async () => {
    const source = await changedSource()
    await fanOut(source)
    const master = byKey(bus.layers(bus.masterId))
    const { headline, extra } = byKey(bus.layers(idAt(WIDE.label, 'en')))
    expect(headline).toMatchObject({ copy: master.headline?.copy, translationStatus: null })
    expect(headline?.overrides).not.toContain('copy')
    expect(extra).toMatchObject({ linked: false, copy: 'Nur heute', translationStatus: 'missing' })
  })

  it('naming the master is the master fan-out', async () => {
    const result = await fanOut(bus.masterId, { languages: ['de'] })
    expect(result).toMatchObject({ ok: true })
    expect(
      bus
        .variants()
        .map((v) => v.sizeLabel)
        .sort(),
    ).toEqual([SQUARE.label, WIDE.label, WIDE.label].sort())
    for (const l of bus.layers(idAt(WIDE.label, 'en'))) expect(l.linked).toBe(true)
  })

  it('undo removes the new variants, redo brings them back', async () => {
    const source = await changedSource()
    const reply = (await fanOut(source)) as { data: { variantIds: string[] } }
    expect(await bus.changed(() => bus.history('undo'))).toMatchObject({ ok: true })
    expect(bus.variants().map((v) => v.id)).toEqual([source])
    expect(await bus.changed(() => bus.history('redo'))).toMatchObject({ ok: true })
    expect(
      bus
        .variants()
        .map((v) => v.id)
        .sort(),
    ).toEqual([source, ...reply.data.variantIds].sort())
  })
})

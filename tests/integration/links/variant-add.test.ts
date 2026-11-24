// P5-10 (spec/links-and-sync.md, "Fan-out"): variant.add makes one variant from the master with
// planVariant; agents may run it.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { TALL } from '../campaigns/campaign-fixture'
import { makeFanOutBus, type FanOutBus } from './fan-out-fixture'
import {
  addCampaignSize,
  fontSizeOf,
  layerOf,
  setBrief,
  SMALL,
  tiedMaster,
  TOP,
  words,
} from './fan-out-layout-fixture'
import { layoutBoxOf } from '@/shared/links/source-layout'

let bus: FanOutBus
beforeEach(async () => {
  bus = await makeFanOutBus()
})
afterEach(() => bus.cleanup())

const input = (over: Record<string, unknown> = {}) => ({
  directionId: bus.directionId,
  sizeLabel: TALL.label,
  language: 'en',
  format: 'image',
  ...over,
})
const backgroundOf = (id: string) => bus.layers(id).find((l) => l.type === 'background')

describe('variant.add [P5-10]', () => {
  it('makes one linked variant with crop', async () => {
    const result = await bus.changed(() => bus.user('variant.add', input({ fit: 'crop' })))
    const made = bus.at(TALL.label, 'en')
    expect(result).toEqual({ ok: true, data: { variantId: made?.id } })
    expect(bus.variants()).toHaveLength(1)
    expect(made).toMatchObject({ title: bus.master().title, rev: 0, createdBy: 'user' })
    expect(backgroundOf(made?.id ?? '')?.geometry).toEqual({
      x: -420,
      y: 0,
      width: 1920,
      height: 1920,
      rotation: 0,
      crop: null,
    })
    for (const l of bus.layers(made?.id ?? '')) expect(l.linked).toBe(true)
  })

  it('fits by scale when fit is left out', async () => {
    await bus.user('variant.add', input())
    expect(backgroundOf(bus.at(TALL.label, 'en')?.id ?? '')?.geometry).toMatchObject({
      x: 0,
      y: 420,
      width: 1080,
    })
  })

  it('undo removes it', async () => {
    await bus.user('variant.add', input())
    expect(await bus.changed(() => bus.history('undo'))).toMatchObject({ ok: true })
    expect(bus.variants()).toEqual([])
  })

  it('refuses a combination that exists with variant_exists', async () => {
    await bus.user('variant.add', input())
    const error = await expectRefused(
      bus,
      () => bus.user('variant.add', input()),
      'RULE_VIOLATION',
      'variant_exists',
    )
    expect(error.message).toBe(
      'This direction already has a variant at this size, language and format.',
    )
    await expectRefused(
      bus,
      () => bus.user('variant.add', input({ sizeLabel: bus.master().sizeLabel })),
      'RULE_VIOLATION',
      'variant_exists',
    )
  })

  it('refuses a size not in the campaign with not_in_campaign', async () => {
    await expectRefused(
      bus,
      () => bus.user('variant.add', input({ sizeLabel: '4x5' })),
      'RULE_VIOLATION',
      'not_in_campaign',
    )
  })

  it('lets the agent run it, with created_by agent', async () => {
    const result = await bus.agent('variant.add', input())
    expect(result).toMatchObject({ ok: true })
    expect(bus.at(TALL.label, 'en')?.createdBy).toBe('agent')
  })
})

// MV-7 (spec/make-variants.md, "Making variants from a variant": variant.add stays master-only
// and uses the new placement and the fit).
describe('variant.add, text that fits and the layout [MV-7]', () => {
  it('fits long brief words in a new language and adds the style.fontSize path', async () => {
    setBrief(bus, '$.copy', { de: { headline: words(120) } })
    const square = bus.master().sizeLabel
    await bus.user('variant.add', input({ sizeLabel: square, language: 'de' }))
    const master = layerOf(bus, bus.masterId, 'headline')
    const de = layerOf(bus, bus.at(square, 'de')?.id ?? '', 'headline')
    expect(de.copy).toBe(words(120))
    expect(fontSizeOf(de)).toBeLessThan(fontSizeOf(master))
    expect(de.overrides).toEqual(['style.fontSize'])
  })

  it('scales the text measures at a smaller size for an agent too', async () => {
    addCampaignSize(bus, SMALL)
    expect(await bus.agent('variant.add', input({ sizeLabel: SMALL.label }))).toMatchObject({
      ok: true,
    })
    const master = layerOf(bus, bus.masterId, 'headline')
    const small = layerOf(bus, bus.at(SMALL.label, 'en')?.id ?? '', 'headline')
    expect(fontSizeOf(small)).toBeLessThanOrEqual(Math.round((fontSizeOf(master) * 250) / 1080))
    expect(small.overrides).toContain('style.fontSize')
  })

  it("lets the campaign's stored layout break a tie between layouts", async () => {
    tiedMaster(bus)
    setBrief(bus, '$.layout', TOP.id)
    await bus.user('variant.add', input())
    const tall = layerOf(bus, bus.at(TALL.label, 'en')?.id ?? '', 'headline')
    expect(tall.geometry).toEqual(layoutBoxOf(TOP, { key: 'headline' }, TALL))
  })
})

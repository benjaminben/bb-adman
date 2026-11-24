import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import {
  makeCampaignBus,
  createInput,
  insertImage,
  SQUARE,
  type CampaignBus,
} from './campaign-fixture'
import { buildMasterLayers } from '@/shared/templates/master-layers'
import { starterTemplate } from '@/shared/templates/starter'
import { starterLayoutOf } from '@/shared/config/starter-layouts'
import { campaignCreateAgentInput } from '@/shared/schemas/commands/campaign-agent'
import type { SlotFills } from '@/shared/templates/types'
import type { LayerRow } from '@/shared/schemas/rows/layer'

let bus: CampaignBus
beforeEach(() => {
  bus = makeCampaignBus()
})
afterEach(() => bus.cleanup())

const DARK = '#0B3D2E'
const LIGHT = '#FFF6E5'

const layers = () => bus.rows('layer') as LayerRow[]
const layerByKey = (key: string) => layers().find((l) => l.key === key) ?? null
const textLayers = () => layers().filter((l) => l.type === 'text')
// With a call to action, so the master has a second text layer.
const briefWith = (extra: Record<string, unknown> = {}) => ({
  ...createInput().brief,
  callToAction: 'Shop now',
  ...extra,
})
const ruleSet = {
  requiredAssetIds: [] as string[],
  palette: [],
  requiredWords: {},
  prohibitedWords: {},
}

function addBrandAssets(): void {
  insertImage(bus, { id: 'LOGO' })
  insertImage(bus, { id: 'HEAD', kind: 'font' })
  insertImage(bus, { id: 'BODY', kind: 'font' })
}

// The fills the stored master was built from, read back from its rows.
function fillsOf(rows: LayerRow[]): SlotFills {
  const fills: SlotFills = {}
  for (const row of rows) {
    if (row.type === 'text') fills[row.key] = { text: row.copy ?? '' }
    else if (row.source && 'assetId' in row.source && row.source.assetId) {
      fills[row.key] = { assetId: row.source.assetId }
    }
  }
  return fills
}

describe('campaign.create layout [spec/brief-brand.md "campaign.create", BB-4]', () => {
  it("builds the master from the brief's layout: its boxes and its background", async () => {
    const made = await bus.create({ brief: briefWith({ layout: 'flat-centre-top' }) })
    expect(made).toMatchObject({ ok: true })
    const layout = starterLayoutOf('flat-centre-top')
    if (!layout) throw new Error('flat-centre-top is missing')
    const expected = buildMasterLayers(starterTemplate, SQUARE, fillsOf(layers()), layout)
    expect(layers()).toHaveLength(expected.length)
    for (const want of expected) {
      expect(layerByKey(want.key)).toMatchObject({ geometry: want.geometry, style: want.style })
    }
    expect(layerByKey('background')?.style).toMatchObject({ fillColor: '#F2F2F5', shade: null })
  })

  it('answers NOT_FOUND for a layout the build does not have, writing nothing', async () => {
    const error = await expectRefused(
      bus,
      () => bus.create({ brief: briefWith({ layout: 'nope' }) }),
      'NOT_FOUND',
    )
    expect(error.message).toBe('That layout is not in this build.')
  })
})

describe('campaign.create brand [spec/brief-brand.md "The rules", A-397, A-398, A-406]', () => {
  it('puts the logo first among the required assets and in the logo layer', async () => {
    addBrandAssets()
    insertImage(bus, { id: 'OTHER' })
    const made = await bus.create({
      ruleSet: { ...ruleSet, requiredAssetIds: ['OTHER'] },
      brand: { logoAssetId: 'LOGO' },
    })
    expect(made).toMatchObject({ ok: true })
    expect(bus.rows('rule_set')[0]).toMatchObject({ requiredAssetIds: ['LOGO', 'OTHER'] })
    expect(layerByKey('logo')).toMatchObject({ source: { assetId: 'LOGO' } })
  })

  it('replaces the palette with the brand colours', async () => {
    const given = { ...ruleSet, palette: ['#112233'] }
    await bus.create({ ruleSet: given, brief: briefWith({ brand: { colours: [DARK, LIGHT] } }) })
    expect(bus.rows('rule_set')[0]).toMatchObject({ palette: [DARK, LIGHT] })
  })

  it('replaces the palette with the brand colours also with copyRuleSetFrom', async () => {
    const first = (await bus.create({ ruleSet: { ...ruleSet, palette: ['#AABBCC'] } })) as {
      data: { campaignId: string }
    }
    const subjectMap = [
      { subjectId: 'can', create: false },
      { subjectId: 'bottle', create: false },
    ]
    const second = (await bus.create({
      subjectMap,
      copyRuleSetFrom: first.data.campaignId,
      brief: briefWith({ brand: { colours: [DARK] } }),
    })) as { ok: boolean; data: { campaignId: string } }
    expect(second.ok).toBe(true)
    const copied = bus.rows('rule_set').find((r) => r.campaignId === second.data.campaignId)
    expect(copied).toMatchObject({ palette: [DARK] })
  })

  it('sets the heading font on the headline and the body font on the call to action', async () => {
    addBrandAssets()
    await bus.create({
      brief: briefWith(),
      brand: { headingFontAssetId: 'HEAD', bodyFontAssetId: 'BODY' },
    })
    expect(layerByKey('headline')?.style).toMatchObject({ fontAssetId: 'HEAD' })
    expect(layerByKey('call-to-action')?.style).toMatchObject({ fontAssetId: 'BODY' })
  })

  it('leaves the other layers on the default font when only one font is given', async () => {
    addBrandAssets()
    await bus.create({ brief: briefWith(), brand: { headingFontAssetId: 'HEAD' } })
    expect(layerByKey('headline')?.style).toMatchObject({ fontAssetId: 'HEAD' })
    expect(layerByKey('call-to-action')?.style).toMatchObject({ fontAssetId: null })
  })

  it('colours each text layer with one of the brand colours', async () => {
    await bus.create({ brief: briefWith({ brand: { colours: [DARK, LIGHT] } }) })
    expect(textLayers()).toHaveLength(2)
    for (const layer of textLayers()) {
      expect([DARK, LIGHT]).toContain((layer.style as { color: string }).color)
    }
  })

  it("keeps a brand font's fontPublishAllowed false", async () => {
    addBrandAssets()
    await bus.create({ brand: { headingFontAssetId: 'HEAD', bodyFontAssetId: 'BODY' } })
    const fonts = bus.rows('asset').filter((a) => a.kind === 'font')
    expect(fonts.map((a) => a.fontPublishAllowed)).toEqual([false, false])
  })
})

describe('campaign.create brand refusals [spec/brief-brand.md "Security rules", R-12]', () => {
  const LOGO_MESSAGE = "The brand logo is not a picture in this project's asset library."
  const FONT_MESSAGE = "A brand font is not a font in this project's asset library."

  it.each([
    { name: 'a heading font ID that is a picture', brand: { headingFontAssetId: 'LOGO' } },
    { name: 'a body font ID that is a picture', brand: { bodyFontAssetId: 'LOGO' } },
    { name: 'an unknown font ID', brand: { bodyFontAssetId: 'GHOST' } },
  ])('answers NOT_FOUND for $name, writing nothing', async ({ brand }) => {
    addBrandAssets()
    const error = await expectRefused(bus, () => bus.create({ brand }), 'NOT_FOUND')
    expect(error.message).toBe(FONT_MESSAGE)
  })

  it.each([
    { name: 'a logo ID that is a font', logoAssetId: 'HEAD' },
    { name: 'an unknown logo ID', logoAssetId: 'GHOST' },
    { name: 'a reference-library logo', logoAssetId: 'REF' },
  ])('answers NOT_FOUND for $name, writing nothing', async ({ logoAssetId }) => {
    addBrandAssets()
    insertImage(bus, { id: 'REF', library: 'reference' })
    const error = await expectRefused(
      bus,
      () => bus.create({ brand: { logoAssetId } }),
      'NOT_FOUND',
    )
    expect(error.message).toBe(LOGO_MESSAGE)
  })

  it('answers NOT_FOUND for a reference-library font, writing nothing', async () => {
    insertImage(bus, { id: 'REF_FONT', kind: 'font', library: 'reference' })
    const error = await expectRefused(
      bus,
      () => bus.create({ brand: { headingFontAssetId: 'REF_FONT' } }),
      'NOT_FOUND',
    )
    expect(error.message).toBe(FONT_MESSAGE)
  })
})

describe('campaign.create stored brief [spec/brief-brand.md, A-395]', () => {
  it('keeps layout, artDirection, adsPer and brand.colours, and no other brand key', async () => {
    addBrandAssets()
    const brief = briefWith({
      layout: 'photo-top-centre',
      artDirection: 'Soft morning light',
      adsPer: 'subject',
      brand: { colours: [DARK], logo: 'brand/logo.png', fonts: { heading: 'a.woff2' } },
    })
    const made = await bus.create({ brief, brand: { logoAssetId: 'LOGO' } })
    expect(made).toMatchObject({ ok: true })
    const stored = (bus.rows('campaign')[0] as { brief: Record<string, unknown> }).brief
    expect(stored).toMatchObject({
      layout: 'photo-top-centre',
      artDirection: 'Soft morning light',
      adsPer: 'subject',
    })
    expect(stored.brand).toEqual({ colours: [DARK] })
  })

  it('gives the MCP create_campaign input no brand field', () => {
    expect(Object.keys(campaignCreateAgentInput.shape)).not.toContain('brand')
  })
})

import { describe, it, expect } from 'vitest'
import { Brief, BriefDraft } from '@/shared/schemas/brief'
import { campaignCreateInput, campaignCreateToolInput } from '@/shared/schemas/commands/campaign'

const brief = {
  campaignName: 'Summer',
  region: 'US',
  audience: 'Everyone',
  message: 'Stay cool',
  subjects: [{ name: 'Bottle' }],
}

const rawBrand = {
  logo: 'brand/logo.png',
  colours: ['#0b3', 'teal'],
  fonts: { heading: 'brand/Headline.woff2', body: '/fonts/Body.ttf' },
}

// spec/brief-brand.md "Schemas" [A-395].
describe('BriefDraft brand fields [spec/brief-brand.md "Schemas"]', () => {
  it('keeps the raw brand texts, layout, art direction and adsPer', () => {
    const raw = { brand: rawBrand, layout: ' Nope ', artDirection: ' x ', adsPer: 'banana' }
    expect(BriefDraft.parse(raw)).toEqual(raw)
  })

  it('reads one colour text as given', () => {
    expect(BriefDraft.parse({ brand: { colours: '#0B3D2E' } })).toEqual({
      brand: { colours: '#0B3D2E' },
    })
  })

  it('drops a brand that is not an object', () => {
    expect(BriefDraft.parse({ brand: 'logo.png', layout: 'x' })).toEqual({ layout: 'x' })
  })

  it('drops fonts or colours of the wrong type and keeps the rest', () => {
    expect(BriefDraft.parse({ brand: { logo: 'a.png', fonts: 'x.ttf', colours: 3 } })).toEqual({
      brand: { logo: 'a.png' },
    })
    expect(BriefDraft.parse({ brand: { fonts: { heading: 4, body: 'b.ttf' } } })).toEqual({
      brand: { fonts: { body: 'b.ttf' } },
    })
  })

  it('drops layout, artDirection and adsPer of the wrong type', () => {
    expect(BriefDraft.parse({ layout: 1, artDirection: [], adsPer: true })).toEqual({})
  })
})

describe('Brief brand fields [spec/brief-brand.md "Schemas"]', () => {
  it('keeps the colours and drops brand.logo and brand.fonts', () => {
    const parsed = Brief.parse({ ...brief, brand: { ...rawBrand, colours: ['#0B3D2E'] } })
    expect(parsed.brand).toEqual({ colours: ['#0B3D2E'] })
  })

  it('refuses a colour that is not #RRGGBB', () => {
    for (const colour of ['#0b3', 'teal', '#12345']) {
      expect(Brief.safeParse({ ...brief, brand: { colours: [colour] } }).success).toBe(false)
    }
  })

  it('takes adsPer campaign or subject and refuses any other text', () => {
    expect(Brief.parse({ ...brief, adsPer: 'subject' }).adsPer).toBe('subject')
    expect(Brief.parse({ ...brief, adsPer: 'campaign' }).adsPer).toBe('campaign')
    expect(Brief.safeParse({ ...brief, adsPer: 'banana' }).success).toBe(false)
  })

  it('accepts any layout text and keeps the art direction', () => {
    const parsed = Brief.parse({ ...brief, layout: 'gone-layout', artDirection: 'Soft light' })
    expect(parsed.layout).toBe('gone-layout')
    expect(parsed.artDirection).toBe('Soft light')
  })
})

describe('campaign.create brand IDs [spec/brief-brand.md "Schemas"]', () => {
  const input = {
    projectId: 'p1',
    brief,
    subjectMap: [{ subjectId: 'bottle-1', create: true }],
    languages: ['en-US'],
    sizes: [{ label: '1x1', width: 1080, height: 1080 }],
    templateId: 'starter',
  }
  const brand = { logoAssetId: 'L1', headingFontAssetId: 'F1', bodyFontAssetId: 'F2' }

  it('takes the three brand asset IDs, each optional', () => {
    expect(campaignCreateInput.parse({ ...input, brand }).brand).toEqual(brand)
    expect(campaignCreateInput.parse({ ...input, brand: {} }).brand).toEqual({})
    expect(campaignCreateInput.parse(input).brand).toBeUndefined()
  })

  it.each(['logoAssetId', 'headingFontAssetId', 'bodyFontAssetId'])(
    'refuses an empty %s',
    (key) => {
      const parsed = campaignCreateInput.safeParse({ ...input, brand: { [key]: '' } })
      expect(parsed.success).toBe(false)
    },
  )

  it('gives the create_campaign tool no brand: it is dropped', () => {
    expect(Object.keys(campaignCreateToolInput.shape)).not.toContain('brand')
    const parsed = campaignCreateToolInput.parse({ ...input, brand })
    expect(parsed).not.toHaveProperty('brand')
  })
})

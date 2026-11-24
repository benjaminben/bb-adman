// BB-5 (spec/brief-brand.md "Agents", A-401; security class): the brand in
// create_campaign_from_brief. Brand files go by asset ID only: a path, full or relative, is
// refused before any ask with no disk read and no event, and the message names the field,
// never the text. Bad colours, layouts and adsPer values are refused with the field named. The
// stored brief holds only cleaned values. Made-up names only.
import fs from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { replyJson } from './tool-client'
import { pngBytes, ttfBytes } from './import-assets-fixture'
import { briefSetUp, type BriefSetUp } from './brief-tool-fixture'
import { STARTER_LAYOUTS } from '@/shared/config/starter-layouts'
import { BRIEF_TOOLS } from '@/main/mcp/tools/brief-tools'

let x: BriefSetUp | undefined
afterEach(async () => {
  vi.restoreAllMocks()
  await x?.close()
  x = undefined
})

type Made = { campaignId: string; variantId: string }

const brandBrief = (extra: Record<string, unknown> = {}, pictures?: string[]) =>
  JSON.stringify({
    campaignName: 'Harbour Roast',
    region: 'US',
    audience: 'Morning commuters',
    message: 'Wake up warm',
    callToAction: 'Order now',
    subjects: [{ name: 'Travel mug', ...(pictures ? { pictures } : {}) }],
    ...extra,
  })

async function brandAssets(s: BriefSetUp) {
  return {
    logo: await s.png('brand/logo.png', 4),
    head: await s.imported('brand/Head.ttf', ttfBytes()),
    body: await s.imported('brand/Body.ttf', ttfBytes()),
  }
}

const layerStyle = (s: BriefSetUp, variantId: string, key: string) => {
  const row = s.rows(`SELECT style FROM layer WHERE variant_id = '${variantId}' AND key = '${key}'`)
  return JSON.parse(String(row[0]?.style ?? '{}')) as Record<string, unknown>
}

const storedBrief = (s: BriefSetUp, campaignId: string) =>
  JSON.parse(String(s.rows(`SELECT brief FROM campaign WHERE id = '${campaignId}'`)[0]?.brief))

describe('create_campaign_from_brief brand by asset ID [BB-5; A-401]', () => {
  it('makes the campaign with the logo, fonts and colours, with no ask', async () => {
    x = await briefSetUp()
    const { logo, head, body } = await brandAssets(x)
    const reply = await x.tool(
      brandBrief({
        brand: { logo, colours: ['#0b3d2e', ' #FFF6E5 '], fonts: { heading: head, body } },
        layout: ' Photo-Top-Centre ',
      }),
    )
    expect(reply.isError).toBeFalsy()
    const made = replyJson<Made>(reply)
    expect(x.asked()).toEqual([])
    const rules = x.rows(`SELECT * FROM rule_set WHERE campaign_id = '${made.campaignId}'`)[0]
    expect(JSON.parse(String(rules?.required_asset_ids))[0]).toBe(logo)
    expect(JSON.parse(String(rules?.palette))).toEqual(['#0B3D2E', '#FFF6E5'])
    expect(layerStyle(x, made.variantId, 'headline')).toMatchObject({ fontAssetId: head })
    expect(layerStyle(x, made.variantId, 'call-to-action')).toMatchObject({ fontAssetId: body })
    const logoLayer = x.rows(
      `SELECT source FROM layer WHERE variant_id = '${made.variantId}' AND key = 'logo'`,
    )
    expect(String(logoLayer[0]?.source)).toContain(logo)
  })

  it('stores only the cleaned values, never the logo or font IDs', async () => {
    x = await briefSetUp()
    const { logo, head } = await brandAssets(x)
    const made = replyJson<Made>(
      await x.tool(
        brandBrief({
          brand: { logo, colours: ['#0b3', '', '#00BB33'], fonts: { heading: head } },
          layout: ' FLAT-CENTRE-TOP ',
          artDirection: '  Mug on the left, soft light  ',
          adsPer: ' Campaign ',
        }),
      ),
    )
    const brief = storedBrief(x, made.campaignId)
    expect(brief).toMatchObject({
      layout: 'flat-centre-top',
      artDirection: 'Mug on the left, soft light',
      adsPer: 'campaign',
    })
    expect(brief.brand).toEqual({ colours: ['#00BB33'] })
    expect(JSON.stringify(brief)).not.toContain(logo)
    expect(JSON.stringify(brief)).not.toContain(head)
  })

  it('refuses an ID that is not a picture or a font of the asset library, by its field', async () => {
    x = await briefSetUp()
    const { logo, head } = await brandAssets(x)
    const before = x.counts()
    const cases: Array<[object, string]> = [
      [
        { logo: head },
        "brand.logo: no picture with that asset ID is in this project's asset library.",
      ],
      [
        { fonts: { heading: logo } },
        "brand.fonts.heading: no font with that asset ID is in this project's asset library.",
      ],
      [
        { fonts: { body: '01JD3K7Q2M8V5X9T4R6Y1B0C2N' } },
        "brand.fonts.body: no font with that asset ID is in this project's asset library.",
      ],
    ]
    for (const [brand, message] of cases) {
      const reply = await x.tool(brandBrief({ brand }))
      expect(replyJson(reply)).toEqual({
        code: 'NOT_FOUND',
        message,
        details: { reason: 'unknown_asset' },
      })
    }
    expect(x.asked()).toEqual([])
    expect(x.counts()).toEqual(before)
  })
})

describe('create_campaign_from_brief brand paths [BB-5; security rules]', () => {
  const pathCases: Array<[string, object, string]> = [
    ['a full logo path', { logo: '/Users/someone/brand/logo-zqmark.png' }, 'brand.logo'],
    ['a relative logo path', { logo: 'brand/logo-zqmark.png' }, 'brand.logo'],
    [
      'a full heading font path',
      { fonts: { heading: '/tmp/head-zqmark.ttf' } },
      'brand.fonts.heading',
    ],
    [
      'a relative body font path',
      { fonts: { body: 'fonts/body-zqmark.woff2' } },
      'brand.fonts.body',
    ],
  ]

  it.each(pathCases)(
    'refuses %s with no disk read, no ask and no event',
    async (_n, brand, field) => {
      x = await briefSetUp()
      const reads = [
        vi.spyOn(fs.promises, 'realpath'),
        vi.spyOn(fs.promises, 'lstat'),
        vi.spyOn(fs.promises, 'open'),
        vi.spyOn(fs.promises, 'stat'),
        vi.spyOn(fs, 'statSync'),
        vi.spyOn(fs, 'openSync'),
      ]
      const before = { counts: x.counts(), events: x.events.length }
      const reply = await x.tool(brandBrief({ brand }))
      expect(replyJson(reply)).toEqual({
        code: 'RULE_VIOLATION',
        message: `${field} names a file. Import it with import_assets first, then give its asset ID.`,
        details: { reason: 'brand_file_path' },
      })
      for (const read of reads) expect(JSON.stringify(read.mock.calls)).not.toContain('zqmark')
      expect(x.asked()).toEqual([])
      const events = x.events.slice(before.events)
      expect(JSON.stringify(events)).not.toContain('zqmark')
      // app.stateChanged (empty) comes from the first tool call turning MCP on, not the brief.
      const quiet = ['agent.activity', 'app.stateChanged']
      expect(events.filter((e) => !quiet.includes(e.name))).toEqual([])
      expect(x.counts()).toEqual(before.counts)
      expect(JSON.stringify(reply) + x.readLogs()).not.toContain('zqmark')
    },
  )

  it('refuses a brand path beside a photo path before the ask for the photo', async () => {
    x = await briefSetUp()
    const photo = x.put('Pictures/mug-front.png', pngBytes(1))
    const before = { counts: x.counts(), files: x.projectFiles() }
    const reply = await x.tool(brandBrief({ brand: { logo: `${x.dir}/logo.png` } }, [photo]))
    expect(replyJson(reply)).toMatchObject({
      code: 'RULE_VIOLATION',
      details: { reason: 'brand_file_path' },
    })
    expect(x.asked()).toEqual([])
    expect(x.counts()).toEqual(before.counts)
    expect(x.projectFiles()).toEqual(before.files)
  })

  it('refuses a brand path sent straight to the files command too', async () => {
    x = await briefSetUp()
    const photo = x.put('Pictures/mug-front.png', pngBytes(1))
    const reply = await x.agent('campaign.createFromBriefWithFiles', {
      projectId: x.projectId,
      text: brandBrief({ brand: { fonts: { body: `${x.dir}/body.ttf` } } }, [photo]),
    })
    expect(reply).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'brand_file_path' } },
    })
    expect(x.asked()).toEqual([])
  })
})

describe('create_campaign_from_brief brand values [BB-5; "The rules"]', () => {
  const ids = STARTER_LAYOUTS.map((l) => l.id).join(', ')
  const valueCases: Array<[string, Record<string, unknown>, string]> = [
    [
      'a bad colour',
      { brand: { colours: ['#0B3D2E', 'teal-zqmark'] } },
      'brand.colours holds a value that is not a hex colour such as #0B3D2E.',
    ],
    [
      'an unknown layout',
      { layout: 'layout-zqmark' },
      `layout is not a starter layout ID. Use one of: ${ids}.`,
    ],
    ['an unknown adsPer', { adsPer: 'adsper-zqmark' }, 'adsPer must be "campaign" or "subject".'],
  ]

  it.each(valueCases)(
    'refuses %s with its message, naming no value',
    async (_n, extra, message) => {
      x = await briefSetUp()
      const before = x.counts()
      const reply = await x.tool(brandBrief(extra))
      expect(replyJson(reply)).toEqual({
        code: 'INVALID_INPUT',
        message,
        details: { reason: 'brief_value' },
      })
      expect(JSON.stringify(reply)).not.toContain('zqmark')
      expect(x.asked()).toEqual([])
      expect(x.counts()).toEqual(before)
    },
  )

  it('refuses the first bad value: colours before layout before adsPer', async () => {
    x = await briefSetUp()
    const reply = await x.tool(
      brandBrief({ brand: { colours: 'nope' }, layout: 'nope', adsPer: 'nope' }),
    )
    expect(replyJson<{ message: string }>(reply).message).toMatch(/^brand\.colours /)
  })

  it('makes the campaign from a brief with no brand fields as before', async () => {
    x = await briefSetUp()
    const reply = await x.tool(brandBrief())
    expect(reply.isError).toBeFalsy()
    const brief = storedBrief(x, replyJson<Made>(reply).campaignId)
    expect(brief.brand).toBeUndefined()
    expect(brief.layout).toBeUndefined()
  })
})

describe('create_campaign_from_brief description [BB-5]', () => {
  it('names the brand fields and says brand files go by asset ID', () => {
    const text = BRIEF_TOOLS[0]?.description ?? ''
    for (const words of ['brand', 'logo', 'colours', 'fonts', 'layout', 'artDirection', 'adsPer']) {
      expect(text).toContain(words)
    }
    expect(text).toMatch(/asset ID/)
  })
})

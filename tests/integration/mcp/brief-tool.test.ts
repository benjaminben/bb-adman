// R2P-7 (spec/phases/round-2-platform.md, D6; security class full): create_campaign_from_brief
// with no file path. Asset IDs need no ask: the campaign, its subjects and each picture's
// attachment are made in one go, and the agent reads IDs only. Every refusal names a picture
// by its place and writes nothing. Made-up names only.
import fs from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { replyJson } from './tool-client'
import { riskyKeys } from './ask-fixture'
import { briefSetUp, markdownBrief, type BriefSetUp } from './brief-tool-fixture'

let x: BriefSetUp | undefined
afterEach(async () => {
  vi.restoreAllMocks()
  await x?.close()
  x = undefined
})

type Made = {
  campaignId: string
  directionId: string
  variantId: string
  subjectIds: string[]
}

const JSON_BRIEF = JSON.stringify({
  campaignName: 'Autumn Tea',
  region: 'US',
  audience: 'Tea drinkers',
  message: 'Warm up slowly',
  subjects: [{ name: 'Tea tin' }, { id: 'can', name: 'Ignored name' }],
})

const YAML_BRIEF = [
  'campaignName: Autumn Tea',
  'region: US',
  'audience: Tea drinkers',
  'message: Warm up slowly',
  'subjects:',
  '  - name: Tea tin',
].join('\n')

const campaignRow = (s: BriefSetUp, id: string) =>
  s.rows(`SELECT * FROM campaign WHERE id = '${id}'`)[0] as Record<string, string>

describe('create_campaign_from_brief with asset IDs only [R2P-7; D6]', () => {
  it('makes the campaign, the subject and the attachment from the D2 example, with no ask', async () => {
    x = await briefSetUp()
    const picture = await x.png('citrus-front.png', 1)
    const reply = await x.tool(markdownBrief([picture.toLowerCase()]))
    expect(reply.isError).toBeFalsy()
    const made = replyJson<Made>(reply)
    expect(Object.keys(made).sort()).toEqual(
      ['campaignId', 'directionId', 'subjectIds', 'variantId'].sort(),
    )
    // directionId is the direction's ID ("dir"), as reply-keys.test.ts allows.
    expect(riskyKeys(made)).toEqual(['directionId'])
    expect(made.subjectIds).toEqual(['citrus-glow'])
    expect(x.asked()).toEqual([])
    const subject = x.rows("SELECT * FROM subject WHERE id = 'citrus-glow'")[0]
    expect(subject).toMatchObject({ name: 'Citrus Glow serum' })
    expect(x.rows(`SELECT subject_id FROM asset WHERE id = '${picture}'`)).toEqual([
      { subject_id: 'citrus-glow' },
    ])
    const campaign = campaignRow(x, made.campaignId)
    expect(campaign).toMatchObject({ name: 'Spring Glow launch', region: 'Canada' })
    expect(JSON.parse(campaign.languages ?? '')).toEqual(['en', 'fr'])
    const brief = JSON.parse(campaign.brief ?? '') as { subjects: object[] }
    expect(brief.subjects).toEqual([
      {
        id: 'citrus-glow',
        name: 'Citrus Glow serum',
        description: 'A 30 ml glass dropper bottle with an orange label',
      },
    ])
    expect(campaign.brief).not.toContain(picture)
    expect(x.rows(`SELECT * FROM variant WHERE id = '${made.variantId}'`)).toHaveLength(1)
    // A-122: the subject-image slot is filled with the attached picture, as create_campaign does.
    const layers = x.rows(`SELECT source FROM layer WHERE variant_id = '${made.variantId}'`)
    expect(JSON.stringify(layers)).toContain(picture)
  })

  it.each([
    ['JSON', JSON_BRIEF, ['Tea-tin', 'can']],
    ['YAML', YAML_BRIEF, ['Tea-tin']],
  ])('reads a %s brief and reuses a subject the project holds', async (_n, text, ids) => {
    x = await briefSetUp()
    const before = x.counts()
    const made = replyJson<Made>(await x.tool(text))
    expect(made.subjectIds).toEqual(ids)
    expect(x.counts().subject).toBe((before.subject ?? 0) + 1)
    expect(x.rows("SELECT name FROM subject WHERE id = 'can'")).toEqual([{ name: 'Can' }])
    const linked = x.rows(
      `SELECT subject_id FROM campaign_subject WHERE campaign_id = '${made.campaignId}'`,
    )
    expect(linked.map((l) => l.subject_id)).toEqual(ids)
  })

  it('refuses an incomplete brief with brief_incomplete, naming the fields', async () => {
    x = await briefSetUp()
    const before = x.counts()
    const reply = await x.tool('# Spring Glow launch\n\nMessage: Glow all day')
    expect(replyJson(reply)).toEqual({
      code: 'INVALID_INPUT',
      message: 'The brief is missing: region, audience, subjects.',
      details: { reason: 'brief_incomplete', fields: ['region', 'audience', 'subjects'] },
    })
    expect(x.counts()).toEqual(before)
  })

  it('refuses a text it cannot read through the plain command', async () => {
    x = await briefSetUp()
    expect(replyJson(await x.tool('   '))).toMatchObject({
      code: 'INVALID_INPUT',
      details: { reason: 'brief_unreadable' },
    })
  })

  it('refuses a relative picture with no disk read and no ask', async () => {
    x = await briefSetUp()
    const reads = [
      vi.spyOn(fs.promises, 'realpath'),
      vi.spyOn(fs.promises, 'lstat'),
      vi.spyOn(fs.promises, 'open'),
      vi.spyOn(fs.promises, 'stat'),
    ]
    const before = x.counts()
    const reply = await x.tool(markdownBrief(['Pictures/citrus-front.png']))
    expect(replyJson(reply)).toEqual({
      code: 'INVALID_INPUT',
      message:
        'Subject 1, picture 1 is neither an asset ID nor a full file path. A brief sent as ' +
        'text has no folder.',
      details: { reason: 'picture_not_full_path' },
    })
    for (const read of reads) {
      expect(JSON.stringify(read.mock.calls)).not.toContain('citrus-front')
    }
    expect(x.asked()).toEqual([])
    expect(x.counts()).toEqual(before)
  })

  it('refuses an unknown ID, a video and another subject’s photo, and writes nothing', async () => {
    x = await briefSetUp()
    const good = await x.png('good.png', 1)
    const video = await x.video('clip.mp4')
    const others = await x.png('bottle.png', 2, 'bottle')
    const unknown = '01JD3K7Q2M8V5X9T4R6Y1B0C2N'
    const before = x.counts()
    const cases: Array<[string, string, object]> = [
      [unknown, 'NOT_FOUND', { reason: 'unknown_asset' }],
      [video, 'NOT_FOUND', { reason: 'unknown_asset' }],
      [others, 'RULE_VIOLATION', { reason: 'photo_of_other_subject' }],
    ]
    for (const [id, code, details] of cases) {
      const reply = await x.tool(markdownBrief([good, id], 'ID: can'))
      const body = replyJson<{ message: string }>(reply)
      expect(body).toMatchObject({ code, details })
      expect(body.message).toMatch(/^Subject 1, picture 2/)
      expect(JSON.stringify(reply)).not.toContain(id)
    }
    expect(x.counts()).toEqual(before)
    expect(x.rows(`SELECT subject_id FROM asset WHERE id = '${good}'`)).toEqual([
      { subject_id: null },
    ])
  })

  it('refuses a path sent straight to the plain command with brief_names_files', async () => {
    x = await briefSetUp()
    const file = x.put('citrus-front.png', new Uint8Array([1, 2, 3]))
    const before = x.counts()
    const reply = await x.agent('campaign.createFromBrief', {
      projectId: x.projectId,
      text: markdownBrief([file]),
    })
    expect(reply).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'This brief names files. Send it again through the tool so the user can be asked.',
        details: { reason: 'brief_names_files' },
      },
    })
    expect(x.asked()).toEqual([])
    expect(x.counts()).toEqual(before)
  })

  it('puts no brief text in a reply, an event or a log line', async () => {
    x = await briefSetUp()
    const picture = await x.png('citrus-front.png', 1)
    const replies = [
      await x.tool(markdownBrief([picture])),
      await x.tool(markdownBrief(['Pictures/citrus-front.png'])),
    ]
    // project.changed carries the rows to the user's own window, as for campaign.create.
    const events = x.events.filter((e) => e.name !== 'project.changed')
    const seen = JSON.stringify([replies, events]) + x.readLogs()
    for (const words of ['Glow that lasts', 'skin care online', 'citrus-front']) {
      expect(seen).not.toContain(words)
    }
  })
})

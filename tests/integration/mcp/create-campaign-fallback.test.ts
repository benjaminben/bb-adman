// P10-10 (spec/phases/phase-10-slices.md; spec/phases/phase-10.md, A-246; OI-25): an agent may
// leave out sizes and languages, and create_campaign fills them from the brief, else the three
// default sizes and the region's language. The reply goes through a picker and holds exactly
// three IDs. An unknown region with no language is refused by the command as before.
import { afterEach, describe, expect, it } from 'vitest'
import { createInput } from '../campaigns/campaign-fixture'
import { replyJson, type ToolReply } from './tool-client'
import { askSetUp, riskyKeys, type AskSetUp } from './ask-fixture'

let x: AskSetUp | undefined
afterEach(async () => {
  await x?.close()
  x = undefined
})

type Stored = { id: string; sizes: string; languages: string; primary_language: string }

const campaigns = (s: AskSetUp) =>
  s.core.projects
    .requireOpen(s.projectId)
    .db.prepare('SELECT id, sizes, languages, primary_language FROM campaign')
    .all() as Stored[]

const campaignOf = (s: AskSetUp, id: string) => campaigns(s).find((c) => c.id === id)

// The agent's arguments: the subjects the user's campaign made in setup, no sizes, no languages.
function args(s: AskSetUp, brief: Record<string, unknown> = {}) {
  const input = createInput()
  return {
    project_id: s.projectId,
    brief: { ...input.brief, ...brief },
    subject_map: input.subjectMap.map((m) => ({ ...m, create: false })),
    template_id: input.templateId,
  }
}

async function call(brief: Record<string, unknown> = {}) {
  x = await askSetUp()
  const s = await x.session()
  return { s: x, reply: await s.call('create_campaign', args(x, brief)) }
}

const ids = (reply: ToolReply) => replyJson<Record<string, unknown>>(reply)

describe('create_campaign fills what the agent leaves out [A-246, OI-25]', () => {
  it('replies exactly three IDs, through the picker', async () => {
    const { s, reply } = await call()
    expect(reply.isError).toBeFalsy()
    const made = ids(reply)
    expect(Object.keys(made).sort()).toEqual(['campaignId', 'directionId', 'variantId'])
    for (const value of Object.values(made)) expect(typeof value).toBe('string')
    // "dir" in directionId is the only key the risky-name check catches: an ID, not a folder.
    expect(riskyKeys(made)).toEqual(['directionId'])
    const direction = s.core.projects
      .requireOpen(s.projectId)
      .db.prepare('SELECT master_variant_id AS m FROM direction WHERE id = ? AND campaign_id = ?')
      .get(made.directionId, made.campaignId) as { m: string } | undefined
    expect(direction?.m).toBe(made.variantId)
  })

  it('gives the three default sizes and the region language when the brief has neither', async () => {
    const { s, reply } = await call()
    const row = campaignOf(s, String(ids(reply).campaignId))
    expect(JSON.parse(row?.sizes ?? '[]')).toEqual([
      { label: '1x1', width: 1080, height: 1080 },
      { label: '9x16', width: 1080, height: 1920 },
      { label: '16x9', width: 1920, height: 1080 },
    ])
    expect(JSON.parse(row?.languages ?? '[]')).toEqual(['en'])
    expect(row?.primary_language).toBe('en')
  })

  it("takes the brief's own sizes and languages", async () => {
    const { s, reply } = await call({ region: 'DE', sizes: ['4x5', '9:16'], languages: ['de'] })
    expect(reply.isError).toBeFalsy()
    const row = campaignOf(s, String(ids(reply).campaignId))
    expect(JSON.parse(row?.sizes ?? '[]').map((z: { label: string }) => z.label)).toEqual([
      '4x5',
      '9x16',
    ])
    expect(JSON.parse(row?.languages ?? '[]')).toEqual(['de'])
  })

  it('refuses an unknown region with no language, as the command did, and makes nothing', async () => {
    const { s, reply } = await call({ region: 'Atlantis' })
    expect(reply.isError).toBe(true)
    expect(ids(reply)).toMatchObject({ code: 'INVALID_INPUT' })
    expect(riskyKeys(ids(reply))).toEqual([])
    expect(campaigns(s)).toHaveLength(1)
  })
})

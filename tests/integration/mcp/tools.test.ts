import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { makeMcpFixture, stopAndClean, type McpFixture } from './mcp-fixture'
import { BUILT_TOOLS, toolSession, replyJson, type ToolSession } from './tool-client'
import { createInput } from '../campaigns/campaign-fixture'
import type { ProjectGet } from '@/shared/schemas/queries/campaign'

let f: McpFixture | undefined
afterEach(async () => {
  await stopAndClean(f)
  f = undefined
})

const toSnake = (input: Record<string, unknown>) => ({
  brief: input.brief,
  subject_map: input.subjectMap,
  languages: input.languages,
  sizes: input.sizes,
  template_id: input.templateId,
})

async function setUp(): Promise<{ fx: McpFixture; projectId: string; s: ToolSession }> {
  const fx = await makeMcpFixture()
  f = fx
  const { projectId } = data<{ projectId: string }>(
    await fx.user('project.create', { name: 'Tools', location: fx.projectsDir }),
  )
  data(await fx.user('mcp.setEnabled', { enabled: true }))
  return { fx, projectId, s: await toolSession(fx.port, await fx.token()) }
}

const projectOf = async (fx: McpFixture, projectId: string) =>
  data<ProjectGet>(await fx.core.query('project.get', { projectId }, { actor: 'user' }))

describe('the MCP tools [SPEC 4.5; 14 1.56 MCP-B]', () => {
  it('lists the built 4.5 tools and nothing else', async () => {
    const { s } = await setUp()
    expect((await s.list()).map((t) => t.name).sort()).toEqual([...BUILT_TOOLS].sort())
  })

  it('get_project gives what project.get gives, with project_id passed as projectId', async () => {
    const { fx, projectId, s } = await setUp()
    const reply = await s.call('get_project', { project_id: projectId })
    expect(reply.isError).toBeFalsy()
    expect(replyJson(reply)).toEqual(await projectOf(fx, projectId))
  })

  it('create_campaign runs campaign.create as the agent and gives its reply', async () => {
    const { fx, projectId, s } = await setUp()
    const reply = await s.call('create_campaign', {
      project_id: projectId,
      ...toSnake(createInput()),
    })
    expect(reply.isError).toBeFalsy()
    const made = replyJson<{ campaignId: string; variantId: string }>(reply)
    const { campaigns } = await projectOf(fx, projectId)
    expect(campaigns).toMatchObject([{ id: made.campaignId, createdBy: 'agent' }])
    const got = await s.call('get_campaign', {
      project_id: projectId,
      campaign_id: made.campaignId,
    })
    expect(replyJson(got)).toMatchObject({ campaign: { id: made.campaignId } })
  })

  it('returns the app error as a tool error, code and message, for a project not open', async () => {
    const { s } = await setUp()
    const reply = await s.call('get_project', { project_id: 'made-up-project' })
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('list_assets gives the 4.5 fields and no file path [FR-198]', async () => {
    const { fx, projectId, s } = await setUp()
    const abs = `${fx.root}/made-up-folder/made-up-picture.png`
    fx.core.projects
      .requireOpen(projectId)
      .db.prepare(
        `INSERT INTO asset (id, library, kind, origin, storage, subject_id, display_name,
          abs_path, rel_path, mime, byte_size, mtime_ms, content_hash, created_at)
         VALUES ('a1', 'asset', 'image', 'imported', 'linked', NULL, 'Picture', ?,
          'made-up-folder/made-up-picture.png', 'image/png', 1, 1, 'h', '2026-01-01T00:00:00Z')`,
      )
      .run(abs)
    const reply = await s.call('list_assets', { project_id: projectId, kind: 'image' })
    expect(reply.isError).toBeFalsy()
    expect(replyJson(reply)).toEqual([
      {
        id: 'a1',
        displayName: 'Picture',
        kind: 'image',
        library: 'asset',
        subjectId: null,
        width: null,
        height: null,
        durationMs: null,
        fontFamily: null,
      },
    ])
    const text = JSON.stringify(reply)
    expect(text.includes('made-up-picture.png')).toBe(false)
    expect(text.includes(fx.root)).toBe(false)
  })

  it('create_campaign offers no placeSubjectPhoto in any spelling [SP-6, A-122]', async () => {
    const { s } = await setUp()
    const tool = (await s.list()).find((t) => t.name === 'create_campaign')
    const schema = tool?.inputSchema as { properties?: Record<string, unknown> } | undefined
    const keys = Object.keys(schema?.properties ?? {})
    expect(keys).toContain('subject_map')
    expect(keys).not.toContain('placeSubjectPhoto')
    expect(keys).not.toContain('place_subject_photo')
  })

  it.each(['place_subject_photo', 'placeSubjectPhoto'])(
    'drops %s from an agent call: the subject image is still filled [SP-6, A-122]',
    async (field) => {
      const { fx, projectId, s } = await setUp()
      data(await fx.user('subject.create', { projectId, id: 'can', name: 'Can' }))
      const project = fx.core.projects.requireOpen(projectId)
      project.db
        .prepare(
          `INSERT INTO asset (id, library, kind, origin, storage, subject_id, display_name,
            abs_path, rel_path, mime, byte_size, mtime_ms, content_hash, created_at)
           VALUES ('HERO', 'asset', 'image', 'imported', 'linked', 'can', 'Hero', '/x.png',
            'x.png', 'image/png', 1, 1, 'h', '2026-01-01T00:00:00Z')`,
        )
        .run()
      const input = createInput()
      const subject_map = [
        { subjectId: 'can', create: false },
        { subjectId: 'bottle', create: true },
      ]
      const args = { project_id: projectId, ...toSnake(input), subject_map, [field]: false }
      const reply = await s.call('create_campaign', args)
      expect(reply.isError).toBeFalsy()
      const { variantId } = replyJson<{ variantId: string }>(reply)
      const layer = project.db
        .prepare(`SELECT source FROM layer WHERE variant_id = ? AND key = 'subject-image'`)
        .get(variantId) as { source: string } | undefined
      expect(layer && JSON.parse(layer.source)).toMatchObject({ assetId: 'HERO' })
    },
  )

  it('ignores an actor in the arguments or in _meta: the campaign is still the agent’s', async () => {
    const { fx, projectId, s } = await setUp()
    const args = { project_id: projectId, ...toSnake(createInput()), actor: 'user' }
    const reply = await s.call('create_campaign', args, { _meta: { actor: 'user' } })
    expect(reply.isError).toBeFalsy()
    const { campaigns } = await projectOf(fx, projectId)
    expect(campaigns.map((c) => c.createdBy)).toEqual(['agent'])
  })
})

// SP-1 review Note 5 [D-098]: a pictures field an agent sends is dropped and never stored.
describe('create_campaign drops subject pictures [D-098]', () => {
  it('stores and replies a brief whose subjects have no pictures key', async () => {
    const { fx, projectId, s } = await setUp()
    const input = createInput()
    const subjects = input.brief.subjects.map((x) => ({ ...x, pictures: ['/private/secret.png'] }))
    const reply = await s.call('create_campaign', {
      project_id: projectId,
      ...toSnake({ ...input, brief: { ...input.brief, subjects } }),
    })
    expect(reply.isError).toBeFalsy()
    const made = replyJson<{ campaignId: string }>(reply)
    const got = await s.call('get_campaign', {
      project_id: projectId,
      campaign_id: made.campaignId,
    })
    const { campaign } = replyJson<{ campaign: { brief: { subjects: object[] } } }>(got)
    expect(campaign.brief.subjects).toHaveLength(2)
    for (const subject of campaign.brief.subjects) expect(subject).not.toHaveProperty('pictures')
    expect(JSON.stringify(replyJson(got))).not.toContain('secret')
    expect(JSON.stringify(await projectOf(fx, projectId))).not.toContain('secret')
  })
})

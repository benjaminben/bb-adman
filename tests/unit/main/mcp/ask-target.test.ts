// P10-6 (spec/phases/phase-10.md, ask flow, A-238): the one target line the permission dialog
// shows, built from the open project. No ID, no input, no path.
import { afterEach, describe, expect, it } from 'vitest'
import { data, makeFixture, type Fixture } from '../../../integration/core-fixture'
import { createInput } from '../../../integration/campaigns/campaign-fixture'
import { askTarget, NO_TARGET } from '@/main/mcp/ask-target'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

type Made = { projectId: string; campaignId: string; variantId: string }

async function project(name = 'Spring Work', campaignName = 'Summer Splash!'): Promise<Made> {
  f = makeFixture()
  const { projectId } = data<{ projectId: string }>(
    await f.user('project.create', { name, location: f.projectsDir }),
  )
  const input = createInput()
  const made = data<{ campaignId: string; variantId: string }>(
    await f.user('campaign.create', {
      projectId,
      ...input,
      brief: { ...input.brief, campaignName },
    }),
  )
  return { projectId, ...made }
}

function variantCount(m: Made): number {
  const db = f!.core.projects.requireOpen(m.projectId).db
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM variant v JOIN direction d ON d.id = v.direction_id
       WHERE d.campaign_id = ?`,
    )
    .get(m.campaignId) as { n: number }
  return row.n
}

function variantLine(m: Made): string {
  const db = f!.core.projects.requireOpen(m.projectId).db
  const v = db
    .prepare('SELECT title, size_label AS sizeLabel, language FROM variant WHERE id = ?')
    .get(m.variantId) as { title: string; sizeLabel: string; language: string }
  return `${v.title} · ${v.sizeLabel} · ${v.language}`
}

const ask = (command: string, projectId: string | null, input: unknown) => ({
  command,
  agentClient: null,
  projectId,
  input,
})

describe('askTarget [P10-6; A-238]', () => {
  it('names a campaign, its variant count and its project', async () => {
    const m = await project()
    const n = variantCount(m)
    const line = askTarget(f!.core.projects, ask('campaign.delete', m.projectId, m))
    expect(line).toBe(`Campaign "Summer Splash!" (${n} variants) in "Spring Work"`)
  })

  it('names a variant by title, size and language, and its campaign', async () => {
    const m = await project()
    const input = { projectId: m.projectId, variantId: m.variantId }
    const line = askTarget(f!.core.projects, ask('variant.delete', m.projectId, input))
    expect(line).toBe(`Variant "${variantLine(m)}" in campaign "Summer Splash!"`)
  })

  // The commands refuse such names, so they are planted in the file as an edited file holds them.
  it('removes control and reordering characters from names', async () => {
    const m = await project()
    const db = f!.core.projects.requireOpen(m.projectId).db
    db.prepare("UPDATE project_meta SET value = ? WHERE key = 'name'").run('Spring\u0007 Work‮')
    db.prepare('UPDATE campaign SET name = ? WHERE id = ?').run(
      'Summer\n Splash​!\u0000',
      m.campaignId,
    )
    const line = askTarget(f!.core.projects, ask('campaign.delete', m.projectId, m))
    expect(line).toBe(`Campaign "Summer Splash!" (${variantCount(m)} variants) in "Spring Work"`)
  })

  it.each([
    ['an unknown campaign', 'campaign.delete', { campaignId: 'made-up-campaign' }],
    ['an unknown variant', 'variant.delete', { variantId: 'made-up-variant' }],
    ['an input without the ID', 'campaign.delete', {}],
    ['another command', 'history.undo', {}],
  ])('gives "Something that no longer exists" for %s', async (_what, command, extra) => {
    const m = await project()
    const input = { projectId: m.projectId, ...extra }
    expect(askTarget(f!.core.projects, ask(command, m.projectId, input))).toBe(NO_TARGET)
    expect(NO_TARGET).toBe('Something that no longer exists')
  })

  it('gives "Something that no longer exists" for a project that is not open', async () => {
    const m = await project()
    expect(askTarget(f!.core.projects, ask('campaign.delete', 'made-up-project', m))).toBe(
      NO_TARGET,
    )
    expect(askTarget(f!.core.projects, ask('campaign.delete', null, m))).toBe(NO_TARGET)
  })
})

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

// The count as the line writes it (P10-7 review: "1 variant", else "N variants").
const counted = (n: number) => (n === 1 ? '1 variant' : `${n} variants`)

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
    expect(line).toBe(`Campaign "Summer Splash!" (${counted(n)}) in "Spring Work"`)
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
    expect(line).toBe(`Campaign "Summer Splash!" (${counted(variantCount(m))}) in "Spring Work"`)
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

// P10-7 (security review of P10-6): the dialog shows this line, so a name cannot pass for the
// line's own wording, break it across lines or push the count and the project out of view.
describe('askTarget names in the dialog line [P10-7]', () => {
  const LONG = 'Autumn Market '.repeat(6)
  const CUT = `${[...LONG].slice(0, 60).join('')}…`

  async function lineWith(campaignName: string, projectName = 'Spring Work') {
    const m = await project()
    const db = f!.core.projects.requireOpen(m.projectId).db
    db.prepare("UPDATE project_meta SET value = ? WHERE key = 'name'").run(projectName)
    db.prepare('UPDATE campaign SET name = ? WHERE id = ?').run(campaignName, m.campaignId)
    return { line: askTarget(f!.core.projects, ask('campaign.delete', m.projectId, m)), m }
  }

  it.each([
    ['turns a double quote into a single one', 'Say "Hi" now', "Say 'Hi' now"],
    ['collapses runs of white space to one space', 'Big      Sale', 'Big Sale'],
    ['keeps a name of exactly 60 code points whole', 'A'.repeat(60), 'A'.repeat(60)],
    ['cuts a longer name to 60 code points and ends it with "…"', LONG, CUT],
    ['counts code points, not UTF-16 units', '😀'.repeat(61), `${'😀'.repeat(60)}…`],
  ])('%s', async (_what, name, shown) => {
    const { line, m } = await lineWith(name)
    expect(line).toBe(`Campaign "${shown}" (${counted(variantCount(m))}) in "Spring Work"`)
  })

  it('cuts a long project name the same way', async () => {
    const { line, m } = await lineWith('Summer Splash!', LONG)
    expect(line).toBe(`Campaign "Summer Splash!" (${counted(variantCount(m))}) in "${CUT}"`)
  })

  it('keeps the true count and project readable when a name imitates the line', async () => {
    const { line, m } = await lineWith('Old test" (0 variants) in "Sandbox')
    const n = variantCount(m)
    expect(line).toBe(
      `Campaign "Old test' (0 variants) in 'Sandbox" (${counted(n)}) in "Spring Work"`,
    )
    expect(line.split('"')).toHaveLength(5)
    expect(line.endsWith(`(${counted(n)}) in "Spring Work"`)).toBe(true)
  })

  // P10-7 review: every quote-like mark, not only `"`, so no look-alike closes a name's quotes.
  it.each([
    ['curly double quotes', '“Hi”', "'Hi'"],
    ['curly single quotes and guillemets', '‘a’ «b» ‹c›', "'a' 'b' 'c'"],
    ['the look-alikes', '＂″‶〃〝〞〟״˝„‟', "'''''''''''"],
  ])('turns %s into single quotes', async (_what, name, shown) => {
    const { line, m } = await lineWith(name)
    expect(line).toBe(`Campaign "${shown}" (${counted(variantCount(m))}) in "Spring Work"`)
  })

  it('holds only the four straight quotes the app writes when a name uses curly ones', async () => {
    const { line, m } = await lineWith('Old test” (0 variants) in “Scratch')
    const n = variantCount(m)
    expect(line).toBe(
      `Campaign "Old test' (0 variants) in 'Scratch" (${counted(n)}) in "Spring Work"`,
    )
    expect(line.split('"')).toHaveLength(5)
    expect(line).not.toMatch(/[\p{Pi}\p{Pf}＂″‶〃〝〞〟״˝„‟]/u)
  })

  it('keeps at most two combining marks in a row', async () => {
    const { line, m } = await lineWith(`Ze${'́'.repeat(20)}st`)
    expect(line).toBe(`Campaign "Zé́st" (${counted(variantCount(m))}) in "Spring Work"`)
  })

  it('says "1 variant" for one and "N variants" for more', async () => {
    const { line, m } = await lineWith('Summer Splash!')
    expect(variantCount(m)).toBe(1)
    expect(line).toBe('Campaign "Summer Splash!" (1 variant) in "Spring Work"')
    const db = f!.core.projects.requireOpen(m.projectId).db
    db.exec('CREATE TEMP TABLE extra AS SELECT * FROM variant')
    db.prepare("UPDATE extra SET id = 'made-up-variant-2', language = 'fr'").run()
    db.exec('INSERT INTO variant SELECT * FROM extra')
    const again = askTarget(f!.core.projects, ask('campaign.delete', m.projectId, m))
    expect(again).toBe('Campaign "Summer Splash!" (2 variants) in "Spring Work"')
  })

  it('cleans each part of a variant line', async () => {
    const m = await project()
    const db = f!.core.projects.requireOpen(m.projectId).db
    db.prepare('UPDATE variant SET title = ? WHERE id = ?').run('Hero  "A"', m.variantId)
    db.prepare('UPDATE campaign SET name = ? WHERE id = ?').run(LONG, m.campaignId)
    const input = { projectId: m.projectId, variantId: m.variantId }
    const line = askTarget(f!.core.projects, ask('variant.delete', m.projectId, input))
    expect(line).toMatch(/^Variant "Hero 'A' · [^"]+" in campaign "/)
    expect(line.endsWith(`in campaign "${CUT}"`)).toBe(true)
  })
})

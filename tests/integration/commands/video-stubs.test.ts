// P7-1 (spec/phases/phase-07-slices.md, "P7-1 — Contracts"): every Phase 7 command is
// registered against a stub that checks its input, then refuses in prepare with
// video_not_built and writes nothing. The two system commands are internal. Each owning slice
// removes its own row; P7-10 filled the last stub, so the stub cases went with it.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { AGENT_POLICY } from '@/main/commands/agent-policy'
import { clipCommands } from '@/main/commands/clip'
import { variantCommands } from '@/main/commands/variant'
import { noMediaTool } from '@/main/media/no-media'
import { ok } from '@/shared/schemas/result'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

type Ids = { projectId: string; variantId: string; assetId: string; clipId: string }

// A project with one campaign; the IDs the inputs name. The clip and asset IDs need not exist:
// a stub refuses before it reads anything.
async function open(): Promise<{ fx: Fixture; ids: Ids }> {
  const fx = makeFixture()
  f = fx
  const made = await fx.user('project.create', { name: 'A', location: fx.projectsDir })
  const projectId = data<{ projectId: string }>(made).projectId
  await fx.user('campaign.create', { projectId, ...createInput() })
  const db = fx.core.projects.requireOpen(projectId).db
  const { id } = db.prepare('SELECT id FROM variant LIMIT 1').get() as { id: string }
  return { fx, ids: { projectId, variantId: id, assetId: 'A1', clipId: 'K1' } }
}

type Row = {
  name: string
  input: (ids: Ids) => object
  policy: 'allow' | 'deny'
  internal: boolean
  bad: (ids: Ids) => object
}
const COMMANDS: Row[] = []

describe('Phase 7 registration [P7-1]', () => {
  it('registers the clip commands and the two new variant commands on core', async () => {
    const { fx } = await open()
    const deps = fx.core.deps
    expect(clipCommands(deps).map((h) => h.name)).toEqual([
      'clip.add',
      'clip.update',
      'clip.remove',
      'clip.reorder',
      'clip.restore',
      'clip.addGenerated',
    ])
    const variant = variantCommands(deps).map((h) => h.name)
    expect(variant).toEqual(expect.arrayContaining(['variant.setFormat', 'variant.setSound']))
    expect(fx.core.commandNames).toEqual(expect.arrayContaining(COMMANDS.map((r) => r.name)))
  })

  it('hands every domain the media tool that is not available and answers null', async () => {
    const { fx } = await open()
    expect(fx.core.deps.media).toBe(noMediaTool)
    expect(noMediaTool.available()).toBe(false)
    await expect(
      noMediaTool.embedDetails({ bytes: new Uint8Array(1), details: {} }),
    ).resolves.toBeNull()
  })

  it('variant.setFormat is allowed to an agent and is not internal [D-025]', async () => {
    const { fx } = await open()
    expect(AGENT_POLICY['variant.setFormat']?.policy).toBe('allow')
    expect(fx.core.isInternal('variant.setFormat')).toBe(false)
  })
})

describe('variant.update with a title [P7-1]', () => {
  it('still changes the title alone', async () => {
    const { fx, ids } = await open()
    const input = { projectId: ids.projectId, variantId: ids.variantId, title: 'New title' }
    expect(await fx.user('variant.update', input)).toEqual(ok({ variantId: ids.variantId }))
  })
})

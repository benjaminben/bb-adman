// P7-1 (spec/phases/phase-07-slices.md, "P7-1 — Contracts"): every Phase 7 command is
// registered against a stub that checks its input, then refuses in prepare with
// video_not_built and writes nothing. The two system commands are internal. variant.update
// with durationMs refuses the same way until P7-10. Each owning slice removes its own row.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { AGENT_POLICY, denialMessage } from '@/main/commands/agent-policy'
import { clipCommands } from '@/main/commands/clip'
import { variantCommands } from '@/main/commands/variant'
import { registerIpc, IPC } from '@/main/ipc'
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

const NOT_BUILT = {
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: 'This part of video editing is not built yet.',
    details: { reason: 'video_not_built' },
  },
}

type Row = {
  name: string
  input: (ids: Ids) => object
  policy: 'allow' | 'deny'
  internal: boolean
  bad: (ids: Ids) => object
}
const clip = (ids: Ids) => ({ variantId: ids.variantId, assetId: ids.assetId })
const clipRow = (ids: Ids) => ({
  id: ids.clipId,
  variantId: ids.variantId,
  assetId: ids.assetId,
  startMs: 0,
  inMs: 0,
  outMs: 3000,
  placement: null,
  soundOn: true,
})

const COMMANDS: Row[] = [
  {
    name: 'clip.add',
    input: clip,
    policy: 'deny',
    internal: false,
    bad: (i) => ({ ...clip(i), startMs: -1 }),
  },
  {
    name: 'clip.update',
    input: (i) => ({ clipId: i.clipId, startMs: 1000 }),
    policy: 'deny',
    internal: false,
    bad: (i) => ({ clipId: i.clipId }),
  },
  {
    name: 'clip.remove',
    input: (i) => ({ clipId: i.clipId }),
    policy: 'deny',
    internal: false,
    bad: () => ({ clipId: '' }),
  },
  {
    name: 'clip.reorder',
    input: (i) => ({ variantId: i.variantId, clipIds: [i.clipId] }),
    policy: 'deny',
    internal: false,
    bad: (i) => ({ variantId: i.variantId, clipIds: [] }),
  },
  {
    name: 'clip.restore',
    input: (i) => ({ rows: [clipRow(i)] }),
    policy: 'deny',
    internal: true,
    bad: () => ({ rows: [] }),
  },
  {
    name: 'clip.addGenerated',
    input: clip,
    policy: 'deny',
    internal: true,
    bad: (i) => ({ variantId: i.variantId }),
  },
  {
    name: 'variant.setFormat',
    input: (i) => ({ variantId: i.variantId, format: 'video' }),
    policy: 'allow',
    internal: false,
    bad: (i) => ({ variantId: i.variantId, format: 'gif' }),
  },
]

function snapshot(fx: Fixture, projectId: string): string {
  const db = fx.core.projects.requireOpen(projectId).db
  const tables = ['variant', 'layer', 'background_clip', 'asset']
  return JSON.stringify(tables.map((t) => db.prepare(`SELECT * FROM ${t}`).all()))
}

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

  it.each(COMMANDS)('$name has its policy row', ({ name, policy }) => {
    expect(AGENT_POLICY[name]?.policy).toBe(policy)
  })

  it.each(COMMANDS)('$name is internal exactly when it is a system command', async (row) => {
    const { fx } = await open()
    expect(fx.core.isInternal(row.name)).toBe(row.internal)
  })
})

describe('the Phase 7 command stubs [P7-1]', () => {
  it.each(COMMANDS)('$name as the user refuses video_not_built and writes nothing', async (row) => {
    const { fx, ids } = await open()
    const before = { events: fx.events.length, rows: snapshot(fx, ids.projectId) }
    const input = { projectId: ids.projectId, ...row.input(ids) }
    expect(await fx.user(row.name, input)).toEqual(NOT_BUILT)
    expect(fx.events.slice(before.events)).toEqual([])
    expect(snapshot(fx, ids.projectId)).toBe(before.rows)
    expect(fx.core.undo.state(ids.projectId, `variant:${ids.variantId}`)).toMatchObject({
      canUndo: false,
    })
  })

  it.each(COMMANDS)('$name checks its input before the stub answers', async (row) => {
    const { fx, ids } = await open()
    const input = { projectId: ids.projectId, ...row.bad(ids) }
    expect(await fx.user(row.name, input)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })

  it.each(COMMANDS.filter((r) => r.policy === 'deny'))(
    '$name as the agent is AGENT_DENIED',
    async (row) => {
      const { fx, ids } = await open()
      expect(await fx.agent(row.name, { projectId: ids.projectId, ...row.input(ids) })).toEqual({
        ok: false,
        error: { code: 'AGENT_DENIED', message: denialMessage(row.name) },
      })
    },
  )

  it('variant.setFormat as the agent reaches the stub and is refused the same way', async () => {
    const { fx, ids } = await open()
    const input = { projectId: ids.projectId, variantId: ids.variantId, format: 'video' }
    expect(await fx.agent('variant.setFormat', input)).toEqual(NOT_BUILT)
  })

  it('answers a window that sends an internal command as unknown, and runs nothing', async () => {
    const { fx, ids } = await open()
    type Handler = (event: unknown, ...args: unknown[]) => unknown
    const handlers = new Map<string, Handler>()
    const sent: string[] = []
    registerIpc(
      { handle: (channel: string, fn: Handler) => void handlers.set(channel, fn) },
      {
        execute: (name, input, opts) => {
          sent.push(name)
          return fx.core.bus.execute(name, input, opts)
        },
        query: async () => ok(null),
        isInternal: (name) => fx.core.isInternal(name),
        mayCall: () => true,
      },
    )
    const command = handlers.get(IPC.command)
    const internal = COMMANDS.filter((r) => r.internal)
    expect(internal.map((r) => r.name)).toEqual(['clip.restore', 'clip.addGenerated'])
    for (const row of internal) {
      expect(
        await command?.({}, row.name, { projectId: ids.projectId, ...row.input(ids) }),
      ).toEqual({
        ok: false,
        error: { code: 'INVALID_INPUT', message: `Unknown command: ${row.name}` },
      })
    }
    expect(sent).toEqual([])
  })
})

describe('variant.update with durationMs before P7-10 [P7-1]', () => {
  it('refuses video_not_built and writes nothing, with or without a title', async () => {
    const { fx, ids } = await open()
    const before = { events: fx.events.length, rows: snapshot(fx, ids.projectId) }
    const base = { projectId: ids.projectId, variantId: ids.variantId }
    expect(await fx.user('variant.update', { ...base, durationMs: 8000 })).toEqual(NOT_BUILT)
    expect(await fx.user('variant.update', { ...base, title: 'New', durationMs: 8000 })).toEqual(
      NOT_BUILT,
    )
    expect(fx.events.slice(before.events)).toEqual([])
    expect(snapshot(fx, ids.projectId)).toBe(before.rows)
  })

  it('still changes the title alone', async () => {
    const { fx, ids } = await open()
    const input = { projectId: ids.projectId, variantId: ids.variantId, title: 'New title' }
    expect(await fx.user('variant.update', input)).toEqual(ok({ variantId: ids.variantId }))
  })
})

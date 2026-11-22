// P7-9: who may send the clip commands, on the real core. The agent is denied all six (policy
// deny); the two system commands are internal, so a window that sends one is answered as
// unknown and nothing runs. Moved here from the P7-1 stub test with its clip rows.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { AGENT_POLICY, denialMessage } from '@/main/commands/agent-policy'
import { registerIpc, IPC } from '@/main/ipc'
import { ok } from '@/shared/schemas/result'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

type Ids = { projectId: string; variantId: string }

async function open(): Promise<{ fx: Fixture; ids: Ids }> {
  const fx = makeFixture()
  f = fx
  const made = await fx.user('project.create', { name: 'A', location: fx.projectsDir })
  const projectId = data<{ projectId: string }>(made).projectId
  await fx.user('campaign.create', { projectId, ...createInput() })
  const db = fx.core.projects.requireOpen(projectId).db
  const { id } = db.prepare('SELECT id FROM variant LIMIT 1').get() as { id: string }
  return { fx, ids: { projectId, variantId: id } }
}

const row = (variantId: string) => ({
  id: 'K1',
  variantId,
  assetId: 'A1',
  startMs: 0,
  inMs: 0,
  outMs: 3000,
  placement: null,
  soundOn: true,
})

const COMMANDS: Array<{ name: string; internal: boolean; input: (v: string) => object }> = [
  { name: 'clip.add', internal: false, input: (v) => ({ variantId: v, assetId: 'A1' }) },
  { name: 'clip.update', internal: false, input: () => ({ clipId: 'K1', startMs: 1000 }) },
  { name: 'clip.remove', internal: false, input: () => ({ clipId: 'K1' }) },
  { name: 'clip.reorder', internal: false, input: (v) => ({ variantId: v, clipIds: ['K1'] }) },
  { name: 'clip.restore', internal: true, input: (v) => ({ rows: [row(v)] }) },
  { name: 'clip.addGenerated', internal: true, input: (v) => ({ variantId: v, assetId: 'A1' }) },
  {
    name: 'clip.swap',
    internal: true,
    input: (v) => ({ variantId: v, remove: ['K0'], put: [row(v)] }),
  },
]

describe('clip command access [P7-9]', () => {
  it.each(COMMANDS)('$name has policy deny and is internal only if a system command', async (c) => {
    const { fx } = await open()
    expect(AGENT_POLICY[c.name]?.policy).toBe('deny')
    expect(fx.core.isInternal(c.name)).toBe(c.internal)
  })

  it.each(COMMANDS)('$name as the agent is AGENT_DENIED', async (c) => {
    const { fx, ids } = await open()
    const input = { projectId: ids.projectId, ...c.input(ids.variantId) }
    expect(await fx.agent(c.name, input)).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage(c.name) },
    })
  })

  it('answers a window that sends clip.restore or clip.addGenerated as unknown, and runs nothing', async () => {
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
    const internal = COMMANDS.filter((c) => c.internal)
    expect(internal.map((c) => c.name)).toEqual(['clip.restore', 'clip.addGenerated', 'clip.swap'])
    for (const c of internal) {
      expect(
        await command?.({}, c.name, { projectId: ids.projectId, ...c.input(ids.variantId) }),
      ).toEqual({
        ok: false,
        error: { code: 'INVALID_INPUT', message: `Unknown command: ${c.name}` },
      })
    }
    expect(sent).toEqual([])
  })
})

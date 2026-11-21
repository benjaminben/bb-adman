// P6-4 (spec/phases/phase-06.md, design additions 1 and 2; A-160): translation.restore, the
// system command that undoes set and approve. It is internal (no window may send it), denied
// to the agent, writes exactly the given values and is its own inverse. The internal, window
// and agent checks moved here from registration-p6.test.ts when the stub was replaced.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { AGENT_POLICY, denialMessage } from '@/main/commands/agent-policy'
import { registerIpc, IPC } from '@/main/ipc'
import { ok } from '@/shared/schemas/result'
import { makeTranslationBus, type TranslationBus } from './translation-fixture'

const item = (layerId: string) => ({
  layerId,
  copy: 'Hallo',
  translationStatus: 'approved',
  translationSource: 'user',
  syncedCopyRev: 3,
})

describe('translation.restore is a system command [P6-4]', () => {
  let f: Fixture | undefined
  afterEach(() => {
    f?.cleanup()
    f = undefined
  })

  async function open() {
    const fx = makeFixture()
    f = fx
    const made = await fx.user('project.create', { name: 'A', location: fx.projectsDir })
    return { fx, projectId: data<{ projectId: string }>(made).projectId }
  }

  it('is internal and denied to the agent', async () => {
    const { fx, projectId } = await open()
    expect(fx.core.isInternal('translation.restore')).toBe(true)
    expect(AGENT_POLICY['translation.restore']?.policy).toBe('deny')
    const input = { projectId, items: [item('L1')] }
    expect(await fx.agent('translation.restore', input)).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('translation.restore') },
    })
  })

  it('answers a window that sends it as unknown, and runs nothing', async () => {
    const { fx, projectId } = await open()
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
    const input = { projectId, items: [item('L1')] }
    expect(await command?.({}, 'translation.restore', input)).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Unknown command: translation.restore' },
    })
    expect(sent).toEqual([])
  })

  it('keeps set allowed and approve denied for the agent', () => {
    expect(AGENT_POLICY['translation.set']?.policy).toBe('allow')
    expect(AGENT_POLICY['translation.approve']?.policy).toBe('deny')
  })
})

describe('translation.restore writes the given values [P6-4]', () => {
  let bus: TranslationBus
  let key: string
  beforeEach(async () => {
    bus = await makeTranslationBus()
    key = bus.textKeys[0] as string
  })
  afterEach(() => bus.cleanup())

  it('writes exactly the given values, bumps variant.rev, and answers the layers written', async () => {
    const id = bus.id('D1', key)
    const before = bus.text(id)
    const rev = bus.variant('D1').rev
    const reply = await bus.changed(() => bus.user('translation.restore', { items: [item(id)] }))
    expect(reply).toEqual({ ok: true, data: { layerIds: [id] } })
    expect(bus.text(id)).toEqual({
      copy: 'Hallo',
      translationStatus: 'approved',
      translationSource: 'user',
      copyRev: before.copyRev + 1,
      syncedCopyRev: 3,
    })
    expect(bus.variant('D1').rev).toBe(rev + 1)
  })

  it('refuses a layer named twice and a layer not in the project, writing nothing', async () => {
    const id = bus.id('D1', key)
    const before = bus.text(id)
    expect(await bus.user('translation.restore', { items: [item(id), item(id)] })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    expect(
      await bus.user('translation.restore', { items: [item(id), item('L-none')] }),
    ).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(bus.text(id)).toEqual(before)
  })
})

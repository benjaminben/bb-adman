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
    const input = { projectId, scope: 'variant', items: [item('L1')] }
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
    const input = { projectId, scope: 'variant', items: [item('L1')] }
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
    const reply = await bus.changed(() =>
      bus.user('translation.restore', { scope: 'variant', items: [item(id)] }),
    )
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
    expect(
      await bus.user('translation.restore', { scope: 'variant', items: [item(id), item(id)] }),
    ).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    expect(
      await bus.user('translation.restore', {
        scope: 'variant',
        items: [item(id), item('L-none')],
      }),
    ).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(bus.text(id)).toEqual(before)
  })

  it.each(['campaign', 'variant'] as const)(
    'puts its own inverse on the %s list its input names, with the same scope',
    async (scope) => {
      const id = bus.id('D1', key)
      await bus.user('translation.restore', { scope, items: [item(id)] })
      const list = scope === 'campaign' ? bus.campaignScope : 'variant:D1'
      const other = scope === 'campaign' ? 'variant:D1' : bus.campaignScope
      expect(bus.undoState(list)).toEqual({ canUndo: true, canRedo: false })
      expect(bus.undoState(other)).toEqual({ canUndo: false, canRedo: false })
      await bus.history('undo', list)
      expect(bus.undoState(list)).toEqual({ canUndo: false, canRedo: true })
      expect(bus.undoState(other)).toEqual({ canUndo: false, canRedo: false })
    },
  )

  it('refuses an input with no scope', async () => {
    const id = bus.id('D1', key)
    expect(await bus.user('translation.restore', { items: [item(id)] })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })

  it('takes a 5000-code-point text of two-unit characters through undo, and refuses 5001', async () => {
    const id = bus.id('D1', key)
    const long = '\u{1F600}'.repeat(5000)
    bus.setRow(id, { copy: long, translation_status: 'proposed', translation_source: 'ai' })
    const set = { layerId: id, text: 'Hallo', applyToSameLanguage: false }
    expect(await bus.user('translation.set', set)).toMatchObject({ ok: true })
    expect(await bus.history('undo', 'variant:D1')).toMatchObject({ ok: true })
    expect(bus.text(id).copy).toBe(long)
    expect(await bus.history('redo', 'variant:D1')).toMatchObject({ ok: true })
    expect(bus.text(id).copy).toBe('Hallo')
    const tooLong = { ...item(id), copy: long + '\u{1F600}' }
    expect(
      await bus.user('translation.restore', { scope: 'variant', items: [tooLong] }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(bus.text(id).copy).toBe('Hallo')
  })

  it('takes its own list from the first item even when that layer needs no write', async () => {
    const named = bus.id('D1', key)
    const twin = bus.id('D2', key)
    const now = bus.text(named)
    const unchanged = {
      layerId: named,
      copy: now.copy,
      translationStatus: now.translationStatus,
      translationSource: now.translationSource,
      syncedCopyRev: now.syncedCopyRev,
    }
    const reply = await bus.user('translation.restore', {
      scope: 'variant',
      items: [unchanged, item(twin)],
    })
    expect(reply).toEqual({ ok: true, data: { layerIds: [twin] } })
    expect(bus.undoState('variant:D1')).toEqual({ canUndo: true, canRedo: false })
    expect(bus.undoState('variant:D2')).toEqual({ canUndo: false, canRedo: false })
  })
})

describe('translation.restore puts the first item first in its own inverse', () => {
  let bus: TranslationBus
  beforeEach(async () => {
    bus = await makeTranslationBus()
  })
  afterEach(() => bus.cleanup())

  it('so undoing a restore that wrote only a twin keeps the redo on the first item list', async () => {
    const key = bus.textKeys[0] as string
    const [named, twin] = [bus.id('D1', key), bus.id('D2', key)]
    const { copy, translationStatus, translationSource, syncedCopyRev } = bus.text(named)
    const first = { layerId: named, copy, translationStatus, translationSource, syncedCopyRev }
    await bus.user('translation.restore', { scope: 'variant', items: [first, item(twin)] })
    expect(await bus.history('undo', 'variant:D1')).toMatchObject({ ok: true })
    expect(bus.undoState('variant:D1')).toEqual({ canUndo: false, canRedo: true })
    expect(bus.undoState('variant:D2')).toEqual({ canUndo: false, canRedo: false })
  })
})

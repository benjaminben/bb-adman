// P5-1 (spec/links-and-sync.md, "The campaign undo list", A-141): a handler may name undo
// scopes in clearScopes; after it succeeds, and only then, the bus clears each one in the
// command's own project. A replay that succeeds clears them too.
import { describe, it, expect, afterEach } from 'vitest'
import { z } from 'zod'
import { defineCommand } from '@/main/commands/types'
import { AppError } from '@/shared/schemas/result'
import { makeMultiBus, refusableSet, TEST_SCOPE } from './multi-bus'

let fixture: ReturnType<typeof makeMultiBus> | undefined
afterEach(() => fixture?.cleanup())

const user = { actor: 'user' as const }
const CAMPAIGN = 'campaign:c1'
const EMPTY = { canUndo: false, canRedo: false }

const clearingInput = z.object({
  projectId: z.string(),
  refuse: z.boolean().optional(),
  inverseScope: z.string().optional(),
})

// Test only: records its own inverse (itself) and clears variant:v1.
const clearing = defineCommand({
  name: 'test.clearing',
  input: clearingInput,
  projectId: (input) => input.projectId,
  run(_ctx, input) {
    if (input.refuse) throw new AppError('RULE_VIOLATION', 'Refused by the test.')
    return {
      data: null,
      inverse: { scope: input.inverseScope ?? CAMPAIGN, call: { name: 'test.clearing', input } },
      clearScopes: [TEST_SCOPE],
    }
  },
})

// Test only: an app-scope command that names a project in its log line and asks to clear.
const appClearing = defineCommand({
  name: 'test.appClearing',
  input: z.object({ projectId: z.string() }),
  run: (_ctx, input) => ({
    data: null,
    log: { projectId: input.projectId },
    clearScopes: [TEST_SCOPE],
  }),
})

function setup(count = 1) {
  fixture = makeMultiBus({
    count,
    handlers: (ctl) => [refusableSet(ctl), clearing, appClearing],
  })
  return fixture
}

async function recordVariantEntry(projectId: string) {
  const f = fixture
  if (!f) throw new Error('setup first')
  expect((await f.bus.execute('layer.update', { projectId, value: 'x' }, user)).ok).toBe(true)
  expect(f.undo.state(projectId, TEST_SCOPE).canUndo).toBe(true)
}

describe('HandlerResult.clearScopes [P5-1, A-141]', () => {
  it('leaves the named variant list empty after the command succeeds', async () => {
    const f = setup()
    const [a] = f.projects
    if (!a) throw new Error('one project expected')
    await recordVariantEntry(a.projectId)
    expect((await f.bus.execute('test.clearing', { projectId: a.projectId }, user)).ok).toBe(true)
    expect(f.undo.state(a.projectId, TEST_SCOPE)).toEqual(EMPTY)
    expect(f.undo.state(a.projectId, CAMPAIGN)).toEqual({ canUndo: true, canRedo: false })
  })

  it('clears nothing when the command is refused', async () => {
    const f = setup()
    const [a] = f.projects
    if (!a) throw new Error('one project expected')
    await recordVariantEntry(a.projectId)
    const refused = await f.bus.execute(
      'test.clearing',
      { projectId: a.projectId, refuse: true },
      user,
    )
    expect(refused).toMatchObject({ ok: false, error: { code: 'RULE_VIOLATION' } })
    expect(f.undo.state(a.projectId, TEST_SCOPE)).toEqual({ canUndo: true, canRedo: false })
  })

  it('clears only in the command’s own project', async () => {
    const f = setup(2)
    const [a, b] = f.projects
    if (!a || !b) throw new Error('two projects expected')
    await recordVariantEntry(a.projectId)
    await recordVariantEntry(b.projectId)
    await f.bus.execute('test.clearing', { projectId: a.projectId }, user)
    expect(f.undo.state(a.projectId, TEST_SCOPE)).toEqual(EMPTY)
    expect(f.undo.state(b.projectId, TEST_SCOPE)).toEqual({ canUndo: true, canRedo: false })
  })

  it('clears nothing for an app-scope command, whatever project its log line names', async () => {
    const f = setup()
    const [a] = f.projects
    if (!a) throw new Error('one project expected')
    await recordVariantEntry(a.projectId)
    const done = await f.bus.execute('test.appClearing', { projectId: a.projectId }, user)
    expect(done.ok).toBe(true)
    expect(f.undo.state(a.projectId, TEST_SCOPE)).toEqual({ canUndo: true, canRedo: false })
  })

  it('clears again when its entry is undone, and when it is redone', async () => {
    const f = setup()
    const [a] = f.projects
    if (!a) throw new Error('one project expected')
    const projectId = a.projectId
    await f.bus.execute('test.clearing', { projectId }, user)
    await recordVariantEntry(projectId)
    const undone = await f.bus.execute('history.undo', { projectId, scope: CAMPAIGN }, user)
    expect(undone.ok).toBe(true)
    expect(f.undo.state(projectId, TEST_SCOPE)).toEqual(EMPTY)
    await recordVariantEntry(projectId)
    const redone = await f.bus.execute('history.redo', { projectId, scope: CAMPAIGN }, user)
    expect(redone.ok).toBe(true)
    expect(f.undo.state(projectId, TEST_SCOPE)).toEqual(EMPTY)
    expect(f.undo.state(projectId, CAMPAIGN)).toEqual({ canUndo: true, canRedo: false })
  })

  it('keeps the command’s own inverse when it names the scope it records on', async () => {
    const f = setup()
    const [a] = f.projects
    if (!a) throw new Error('one project expected')
    const input = { projectId: a.projectId, inverseScope: TEST_SCOPE }
    expect((await f.bus.execute('test.clearing', input, user)).ok).toBe(true)
    expect(f.undo.state(a.projectId, TEST_SCOPE)).toEqual({ canUndo: true, canRedo: false })
  })
})

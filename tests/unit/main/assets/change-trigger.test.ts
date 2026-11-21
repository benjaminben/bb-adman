import { describe, it, expect } from 'vitest'
import { checkChangedFiles, withChangeChecks } from '@/main/assets/change-trigger'
import type { BusEvent } from '@/main/commands/bus'
import type { LogInput } from '@/main/log/activity-log'
import type { Result } from '@/shared/schemas/result'

type Call = { name: string; input: unknown }

function harness(reply: () => Promise<Result<unknown>>) {
  const calls: Call[] = []
  const events: BusEvent[] = []
  const lines: LogInput[] = []
  const deps = {
    execute: (name: string, input: unknown) => {
      calls.push({ name, input })
      return reply()
    },
    emit: (e: BusEvent) => events.push(e),
    log: { write: (l: LogInput) => void lines.push(l), prune: () => {} },
  }
  return { deps, calls, events, lines }
}

describe('checkChangedFiles [SPEC 14, Slice A rulings point 2b, A3-4]', () => {
  it('sends asset.checkChanged and then the event for a list that is not empty', async () => {
    const h = harness(async () => ({ ok: true, data: { assetIds: ['a1'] } }))
    await checkChangedFiles(h.deps, 'p1')
    expect(h.calls).toEqual([{ name: 'asset.checkChanged', input: { projectId: 'p1' } }])
    expect(h.events).toEqual([
      { name: 'asset.changedOnDisk', payload: { projectId: 'p1', assetIds: ['a1'] } },
    ])
  })

  it('sends no event for an empty list', async () => {
    const h = harness(async () => ({ ok: true, data: { assetIds: [] } }))
    await checkChangedFiles(h.deps, 'p1')
    expect(h.events).toEqual([])
  })

  it('never runs twice at once for one project', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    const h = harness(async () => {
      await gate
      return { ok: true, data: { assetIds: [] } }
    })
    const first = checkChangedFiles(h.deps, 'p1')
    const second = checkChangedFiles(h.deps, 'p1')
    const other = checkChangedFiles(h.deps, 'p2')
    release()
    await Promise.all([first, second, other])
    expect(h.calls.map((c) => c.input)).toEqual([{ projectId: 'p1' }, { projectId: 'p2' }])
    await checkChangedFiles(h.deps, 'p1')
    expect(h.calls).toHaveLength(3)
  })

  it('logs a refusal and goes no further', async () => {
    const h = harness(async () => ({ ok: false, error: { code: 'NOT_FOUND', message: 'x' } }))
    await checkChangedFiles(h.deps, 'p1')
    expect(h.events).toEqual([])
    expect(h.lines).toEqual([expect.objectContaining({ level: 'warn', ok: false })])
  })

  it('swallows a thrown failure after logging it', async () => {
    const h = harness(async () => {
      throw new Error('boom')
    })
    await expect(checkChangedFiles(h.deps, 'p1')).resolves.toBeUndefined()
    expect(h.events).toEqual([])
    expect(h.lines).toEqual([expect.objectContaining({ level: 'error', ok: false })])
  })
})

describe('withChangeChecks [SPEC 14, Slice A rulings point 2b, A3-4]', () => {
  const opts = { actor: 'user' as const }
  const wrap = (reply: Result<unknown>) => {
    const checked: string[] = []
    const execute = withChangeChecks(
      async () => reply,
      async (projectId) => void checked.push(projectId),
    )
    return { execute, checked }
  }

  it('starts a check after a project.open that succeeds, and gives its reply back', async () => {
    const reply = { ok: true as const, data: { projectId: 'p1', name: 'P', filePath: '/x' } }
    const w = wrap(reply)
    expect(await w.execute('project.open', {}, opts)).toBe(reply)
    expect(w.checked).toEqual(['p1'])
  })

  it('does not wait for the check to finish', async () => {
    const execute = withChangeChecks(
      async () => ({ ok: true, data: { projectId: 'p1' } }),
      () => new Promise<void>(() => {}),
    )
    await expect(execute('project.open', {}, opts)).resolves.toMatchObject({ ok: true })
  })

  it('starts no check after a project.open that fails, or after another command', async () => {
    const failed = wrap({ ok: false, error: { code: 'NOT_FOUND', message: 'x' } })
    await failed.execute('project.open', {}, opts)
    const other = wrap({ ok: true, data: { projectId: 'p1' } })
    await other.execute('project.create', {}, opts)
    expect([...failed.checked, ...other.checked]).toEqual([])
  })
})

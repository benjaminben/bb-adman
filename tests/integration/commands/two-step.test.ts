import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { z } from 'zod'
import { defineCommand } from '@/main/commands/types'
import { AppError } from '@/shared/schemas/result'
import { makeMultiBus } from './multi-bus'

let fixture: ReturnType<typeof makeMultiBus> | undefined
let filesDir: string
afterEach(() => {
  fixture?.cleanup()
  fs.rmSync(filesDir, { recursive: true, force: true })
})

type Calls = { prepare: number; undoPrepare: number }
const input = z.object({
  projectId: z.string(),
  name: z.string(),
  fail: z.enum(['none', 'rule', 'unknown']),
})

// A test-only command with both steps: prepare writes a file, run records its name.
function twoStep(calls: Calls, gate: () => Promise<void> = async () => {}) {
  return defineCommand({
    name: 'asset.import',
    input,
    projectId: (i) => i.projectId,
    async prepare(ctx, i) {
      calls.prepare++
      ctx.project.db.prepare('SELECT 1').get()
      const file = path.join(filesDir, `${i.name}.txt`)
      fs.writeFileSync(file, 'x')
      await gate()
      return { file }
    },
    run(ctx, i, prepared) {
      ctx.project.db
        .prepare("INSERT INTO project_meta (key, value) VALUES ('test_value', ?)")
        .run(path.basename(prepared.file))
      ctx.changes.touch('project_meta', { key: 'test_value' })
      if (i.fail === 'rule') throw new AppError('RULE_VIOLATION', 'No.')
      if (i.fail === 'unknown') throw new Error('broken')
      return { data: { file: path.basename(prepared.file) } }
    },
    undoPrepare(prepared) {
      calls.undoPrepare++
      fs.rmSync(prepared.file, { force: true })
    },
  })
}

function setup(calls: Calls, gate?: () => Promise<void>) {
  filesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-two-step-'))
  fixture = makeMultiBus({ count: 1, handlers: () => [twoStep(calls, gate)] })
  const [p] = fixture.projects
  if (!p) throw new Error('project expected')
  return { f: fixture, p }
}

const user = { actor: 'user' as const }

describe('two-step handlers: prepare, run, undoPrepare [SPEC 3.6]', () => {
  it('runs prepare outside the transaction and passes its value to run', async () => {
    const calls = { prepare: 0, undoPrepare: 0 }
    const { f, p } = setup(calls)
    const result = await f.bus.execute(
      'asset.import',
      { projectId: p.projectId, name: 'a', fail: 'none' },
      user,
    )
    expect(result).toEqual({ ok: true, data: { file: 'a.txt' } })
    expect(p.value()).toBe('a.txt')
    expect(fs.existsSync(path.join(filesDir, 'a.txt'))).toBe(true)
    expect(calls).toEqual({ prepare: 1, undoPrepare: 0 })
  })

  it('calls undoPrepare and rolls back when run refuses', async () => {
    const calls = { prepare: 0, undoPrepare: 0 }
    const { f, p } = setup(calls)
    const result = await f.bus.execute(
      'asset.import',
      { projectId: p.projectId, name: 'a', fail: 'rule' },
      user,
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'RULE_VIOLATION' } })
    expect(p.value()).toBeNull()
    expect(fs.existsSync(path.join(filesDir, 'a.txt'))).toBe(false)
    expect(calls.undoPrepare).toBe(1)
  })

  it('calls undoPrepare and returns INTERNAL when run throws an unknown error', async () => {
    const calls = { prepare: 0, undoPrepare: 0 }
    const { f, p } = setup(calls)
    const result = await f.bus.execute(
      'asset.import',
      { projectId: p.projectId, name: 'a', fail: 'unknown' },
      user,
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'INTERNAL' } })
    expect(fs.existsSync(path.join(filesDir, 'a.txt'))).toBe(false)
    expect(calls.undoPrepare).toBe(1)
  })

  it('returns NOT_FOUND and calls undoPrepare when the project closes during prepare', async () => {
    const calls = { prepare: 0, undoPrepare: 0 }
    let closeNow = () => {}
    const { f, p } = setup(calls, async () => closeNow())
    closeNow = () => void f.registry.remove(p.projectId)
    const result = await f.bus.execute(
      'asset.import',
      { projectId: p.projectId, name: 'a', fail: 'none' },
      user,
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(fs.existsSync(path.join(filesDir, 'a.txt'))).toBe(false)
    expect(calls).toEqual({ prepare: 1, undoPrepare: 1 })
  })

  it('does not run prepare when the input is invalid or the project is not open', async () => {
    const calls = { prepare: 0, undoPrepare: 0 }
    const { f, p } = setup(calls)
    await f.bus.execute('asset.import', { projectId: p.projectId, name: 'a' }, user)
    await f.bus.execute('asset.import', { projectId: 'nope', name: 'a', fail: 'none' }, user)
    expect(calls).toEqual({ prepare: 0, undoPrepare: 0 })
  })
})

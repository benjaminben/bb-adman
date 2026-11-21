import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { gate, makeRunnerFixture, waitFor, type RunnerFixture } from './runner-fixture'
import { closeProjectFile, createProjectFile, type ProjectHandle } from '@/main/db/project-file'
import { readWireRow } from '@/main/db/rows'
import type { JobRow } from '@/shared/schemas/rows/job'

const cleanups: Array<() => void> = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.()
})

function fixture(): RunnerFixture {
  const f = makeRunnerFixture()
  cleanups.push(() => f.cleanup())
  return f
}

// A second open project in the fixture's registry, removed again before the fixture cleans up.
function secondProject(x: RunnerFixture): ProjectHandle {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-jobs-2-'))
  const p = createProjectFile({
    filePath: path.join(dir, 'Q.adman'),
    name: 'Q',
    appVersion: '0.1.0',
    now: 'x',
  })
  x.projects.add(p)
  cleanups.push(() => {
    if (x.projects.remove(p.projectId)) closeProjectFile(p)
    fs.rmSync(dir, { recursive: true, force: true })
  })
  return p
}

const pause = () => new Promise((r) => setTimeout(r, 5))

describe('oldest first across projects [SPEC 3.6 "Jobs" item 2 1.38, 14 1.38 Y16]', () => {
  it('when a place frees, the older job of the second project starts first', async () => {
    const x = fixture()
    const q = secondProject(x)
    const gates: Array<ReturnType<typeof gate<void>>> = []
    x.f.body = async () => {
      const g = gate<void>()
      gates.push(g)
      return g.promise
    }
    for (let i = 0; i < 3; i++) await x.start()
    await waitFor(() => x.f.calls === 3)
    await pause()
    const r = await x.user('test.enqueue', { projectId: q.projectId })
    if (!r.ok) throw new Error('enqueue failed')
    const inSecond = (r.data as { jobId: string }).jobId
    await pause()
    const inFirst = await x.start()
    await pause()
    gates[0]?.open()
    await waitFor(() => x.f.calls === 4)
    const second = readWireRow(q.db, 'job', { id: inSecond }) as JobRow | null
    expect(second?.status).toBe('running')
    expect(x.row(inFirst)?.status).toBe('queued')
    for (const g of gates) g.open()
    await waitFor(() => x.f.calls === 5)
    for (const g of gates) g.open()
  })
})

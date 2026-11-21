// The runner's limit with no jobsAtOnce given (SPEC 14 1.39 Z6, 1.40 AA5). The shared
// fixture always hands the runner three, so this file builds a runner of its own.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { describe, it, expect, afterEach } from 'vitest'
import { createProjectFile, closeProjectFile } from '../../../src/main/db/project-file'
import { createProjectRegistry } from '../../../src/main/db/project-registry'
import { readWireRow } from '../../../src/main/db/rows'
import { createActivityLog } from '../../../src/main/log/activity-log'
import { createUndoLists } from '../../../src/main/history/undo-lists'
import { listProviders } from '../../../src/main/providers/registry'
import { createJobRunner } from '../../../src/main/jobs/runner'
import type { CommandBus } from '../../../src/main/commands/bus'
import type { ProjectContext } from '../../../src/main/commands/types'
import type { CoreDeps } from '../../../src/main/core-deps'
import type { JobRow } from '../../../src/shared/schemas/rows/job'
import { gate, PAID, waitFor } from './runner-fixture'

const cleanups: Array<() => void> = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.()
})

function makeRunner(body: (job: JobRow) => Promise<unknown>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-limit-'))
  const projects = createProjectRegistry()
  const project = createProjectFile({
    filePath: path.join(dir, 'P.adman'),
    name: 'P',
    appVersion: '0.1.0',
    now: 'x',
  })
  projects.add(project)
  const log = createActivityLog({
    dir: path.join(dir, 'logs'),
    minLevel: 'debug',
    now: () => new Date(),
  })
  const providers = [...listProviders({ ADMAN_FAKE_PROVIDERS: '1' }), PAID]
  const secrets = { get: (): string | undefined => undefined }
  const now = () => new Date()
  const deps = { projects, providers, log, now, undo: createUndoLists(), secrets }
  const jobs = createJobRunner({
    deps: () => deps as unknown as CoreDeps,
    bus: () => ({}) as CommandBus,
    emit: () => undefined,
    handlers: [{ kind: 'image_generation', run: (_jc, job) => body(job) }],
    closeWaitMs: 50,
  })
  cleanups.push(() => {
    if (projects.remove(project.projectId)) closeProjectFile(project)
    fs.rmSync(dir, { recursive: true, force: true })
  })
  const ctx = { project } as unknown as ProjectContext
  return {
    start: (provider = 'fake') =>
      jobs.enqueue(ctx, {
        kind: 'image_generation',
        campaignId: 'c1',
        variantId: 'v1',
        layerId: null,
        slot: 'background',
        provider,
        model: 'm1',
        request: { prompt: 'a cat', count: 1 },
        startedBy: 'user',
      }),
    status: (id: string) => (readWireRow(project.db, 'job', { id }) as JobRow | null)?.status,
  }
}

describe('the runner limit with no jobsAtOnce [SPEC 14 1.39 Z6]', () => {
  it('runs four jobs of one provider and holds the fifth as queued', async () => {
    const g = gate()
    let calls = 0
    const r = makeRunner(async () => {
      calls++
      return g.promise
    })
    const ids = [1, 2, 3, 4, 5].map(() => r.start())
    await waitFor(() => calls === 4)
    await new Promise((res) => setTimeout(res, 20))
    expect(calls).toBe(4)
    // Enqueued in one millisecond, so which of the five waits is not fixed: count them.
    expect(ids.map(r.status).sort()).toEqual(['queued', 'running', 'running', 'running', 'running'])
    g.open()
    await waitFor(() => ids.every((id) => r.status(id) === 'succeeded'))
  })

  it('four running at one provider do not hold back a job of another provider', async () => {
    const g = gate()
    const r = makeRunner(async (job) => (job.provider === 'fake' ? g.promise : 'ok'))
    const ids = [1, 2, 3, 4].map(() => r.start())
    const other = r.start('paid-test')
    await waitFor(() => r.status(other) === 'succeeded')
    expect(ids.map(r.status)).toEqual(['running', 'running', 'running', 'running'])
    g.open()
    await waitFor(() => ids.every((id) => r.status(id) === 'succeeded'))
  })
})

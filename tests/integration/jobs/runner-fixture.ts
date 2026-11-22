// Test harness for the job runner (SPEC 3.6 "Jobs", 14 slice D): one real project file, a
// real bus with one test-only command that enqueues, and test-only job kind handlers whose
// body each test sets. Not a test file itself.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { z } from 'zod'
import { createProjectFile, closeProjectFile } from '@/main/db/project-file'
import { createProjectRegistry } from '@/main/db/project-registry'
import { readWireRow } from '@/main/db/rows'
import { createCommandBus, type BusEvent } from '@/main/commands/bus'
import { defineCommand, type CommandHandler } from '@/main/commands/types'
import { createUndoLists } from '@/main/history/undo-lists'
import { createActivityLog } from '@/main/log/activity-log'
import { listProviders } from '@/main/providers/registry'
import { createJobRunner } from '@/main/jobs/runner'
import { jobCancel } from '@/main/commands/job/cancel'
import { jobMarkSeen } from '@/main/commands/job/mark-seen'
import { jobRetry } from '@/main/commands/job/retry'
import { projectClose } from '@/main/commands/project/close'
import { jobList } from '@/main/queries/job'
import type { CoreDeps } from '@/main/core-deps'
import type { JobRunContext } from '@/main/jobs/types'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { AppError } from '@/shared/schemas/result'

// A made-up provider that is not local, so its calls are counted.
export const PAID: ProviderInfo = {
  id: 'paid-test',
  label: 'Paid Test',
  jobs: ['image'],
  available: true,
  secrets: [],
  defaultModels: {},
  local: false,
  cancel: 'stops',
  serverText: false,
}
export const NO_CANCEL: ProviderInfo = {
  ...PAID,
  id: 'no-cancel',
  label: 'No Cancel',
  cancel: 'none',
}

type Body = (jc: JobRunContext, job: JobRow) => Promise<unknown>

const enqueueInput = z.object({
  projectId: z.string(),
  provider: z.string().default('fake'),
  kind: z
    .enum(['image_generation', 'generative_fill', 'video_generation'])
    .default('image_generation'),
  startedBy: z.enum(['user', 'agent']).default('user'),
  failAfter: z.boolean().default(false),
})

export function makeRunnerFixture(
  opts: {
    cancelWaitMs?: number
    closeWaitMs?: number
    jobsAtOnce?: number
    secrets?: Record<string, string>
  } = {},
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-jobs-'))
  const logDir = path.join(dir, 'logs')
  const projects = createProjectRegistry()
  const project = createProjectFile({
    filePath: path.join(dir, 'P.adman'),
    name: 'P',
    appVersion: '0.1.0',
    now: 'x',
  })
  projects.add(project)
  const events: BusEvent[] = []
  const log = createActivityLog({ dir: logDir, minLevel: 'debug', now: () => new Date() })
  const providers = [...listProviders({ ADMAN_FAKE_PROVIDERS: '1' }), PAID, NO_CANCEL]
  const f = {
    body: (async () => ({ done: true })) as Body,
    calls: 0,
  }
  const undo = createUndoLists()
  const secrets = { get: (name: string): string | undefined => opts.secrets?.[name] }
  const now = () => new Date()
  // The agent-run settings the runner's untick check reads (spec/agent-runs.md "Unticking").
  const settings = {
    current: { agentRuns: {} as Record<string, { allowed: boolean }>, agentRunLimit: 4 },
    get() {
      return settings.current
    },
  }
  const deps = { projects, providers, log, now, undo, secrets, settings } as unknown as CoreDeps
  const run = (jc: JobRunContext, job: JobRow) => {
    f.calls++
    return f.body(jc, job)
  }
  const jobs = createJobRunner({
    deps: () => deps,
    bus: () => bus,
    emit: (e) => events.push(e),
    handlers: [
      { kind: 'image_generation', run },
      { kind: 'generative_fill', run },
      { kind: 'video_generation', run },
    ],
    cancelWaitMs: () => opts.cancelWaitMs ?? 2_000,
    closeWaitMs: opts.closeWaitMs ?? 50,
    jobsAtOnce: opts.jobsAtOnce ?? 3,
  })
  deps.jobs = jobs
  // spec/scene.md: project.close tells the render service. This stand-in draws nothing.
  deps.render = {
    thumbnail: () => Promise.reject(new Error('render is not available')),
    render: () => Promise.reject(new Error('render is not available')),
    renderForAgent: () => Promise.reject(new Error('render is not available')),
    renderPictures: () => Promise.reject(new Error('render is not available')),
    renderBackground: () => Promise.reject(new Error('render is not available')),
    drawFull: () => Promise.reject(new Error('render is not available')),
    onEvent: () => undefined,
    projectClosed: async () => undefined,
  }
  const enqueue: CommandHandler = defineCommand({
    name: 'test.enqueue',
    input: enqueueInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const jobId = jobs.enqueue(ctx, {
        kind: input.kind,
        campaignId: 'c1',
        variantId: 'v1',
        layerId: null,
        slot: 'background',
        provider: input.provider,
        model: 'm1',
        request: { prompt: 'a cat', count: 1 },
        startedBy: input.startedBy,
      })
      if (input.failAfter) throw new AppError('RULE_VIOLATION', 'Stopped after enqueue.')
      return { data: { jobId } }
    },
  })
  const bus = createCommandBus({
    handlers: [enqueue, jobRetry(deps), jobCancel(deps), jobMarkSeen(deps), projectClose(deps)],
    projects,
    undo,
    log,
    emit: (e) => events.push(e),
    askPermission: async () => false,
  })

  return {
    f,
    bus,
    jobs,
    events,
    project,
    projects,
    projectId: project.projectId,
    providers,
    settings,
    // Sets or clears an agent tick, as a hand-edit of settings.json would.
    tick(provider: string, allowed: boolean) {
      settings.current = {
        ...settings.current,
        agentRuns: { ...settings.current.agentRuns, [provider]: { allowed } },
      }
    },
    user: (name: string, input: unknown) => bus.execute(name, input, { actor: 'user' }),
    agent: (name: string, input: unknown) => bus.execute(name, input, { actor: 'agent' }),
    list: async (input: Record<string, unknown> = {}) =>
      jobList(deps)({ projectId: project.projectId, ...input }, { actor: 'user' }),
    async start(input: Partial<z.input<typeof enqueueInput>> = {}): Promise<string> {
      const r = await bus.execute(
        'test.enqueue',
        { projectId: project.projectId, ...input },
        {
          actor: 'user',
        },
      )
      if (!r.ok) throw new Error(`enqueue failed: ${JSON.stringify(r.error)}`)
      return (r.data as { jobId: string }).jobId
    },
    row: (id: string) => readWireRow(project.db, 'job', { id }) as JobRow | null,
    jobEvents: (id: string) =>
      events.flatMap((e) => (e.name === 'job.updated' && e.payload.id === id ? [e.payload] : [])),
    logText: () =>
      fs.existsSync(logDir)
        ? fs
            .readdirSync(logDir)
            .map((n) => fs.readFileSync(path.join(logDir, n), 'utf8'))
            .join('')
        : '',
    cleanup() {
      if (projects.remove(project.projectId)) closeProjectFile(project)
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

export type RunnerFixture = ReturnType<typeof makeRunnerFixture>

export async function waitFor(check: () => boolean, ms = 2_000): Promise<void> {
  const end = Date.now() + ms
  while (!check()) {
    if (Date.now() > end) throw new Error('waitFor: timed out')
    await new Promise((r) => setTimeout(r, 5))
  }
}

// A promise the test resolves by hand.
export function gate<T = void>() {
  let open: (value: T) => void = () => undefined
  const promise = new Promise<T>((r) => (open = r))
  return { promise, open }
}

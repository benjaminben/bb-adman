// Test harness for the image_generation job kind (SPEC 14 slice H): one real project file,
// the real runner, AssetService and bus, and a stand-in picture provider that is not local,
// so its calls are counted. Each test sets what each call answers. Not a test file itself.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createProjectFile, closeProjectFile } from '@/main/db/project-file'
import { createProjectRegistry } from '@/main/db/project-registry'
import { readWireRow, readWireRows } from '@/main/db/rows'
import { createCommandBus, type BusEvent } from '@/main/commands/bus'
import { createUndoLists } from '@/main/history/undo-lists'
import { createActivityLog } from '@/main/log/activity-log'
import { createAssetService } from '@/main/assets/service'
import { listProviders } from '@/main/providers/registry'
import { createJobRunner } from '@/main/jobs/runner'
import { assetAddGenerated } from '@/main/commands/asset/add-generated'
import { assetImport } from '@/main/commands/asset/import'
import { jobCancel } from '@/main/commands/job/cancel'
import { generationRunImages } from '@/main/commands/generation/run-images'
import { imageGenerationKind } from '@/main/jobs/kinds/image-generation'
import { greyPng } from '@/main/providers/fake/png'
import {
  ProviderFailure,
  type ImageProvider,
  type ImageResult,
  type RunOptions,
} from '@/main/providers/types'
import type { CoreDeps } from '@/main/core-deps'
import type { ProviderInfo, ProviderErrorKind } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import { seed, VARIANT } from './generation-fixture'

export const PAID: ProviderInfo = {
  id: 'paid-test',
  label: 'Paid Test',
  jobs: ['image'],
  available: true,
  secrets: [],
  defaultModels: { image: 'test-model-1' },
  local: false,
  cancel: 'stops',
  serverText: false,
}
// Like Gemini: not local, and no way to stop a call once it is sent.
export const NO_CANCEL: ProviderInfo = {
  ...PAID,
  id: 'no-cancel',
  label: 'No Cancel',
  cancel: 'none',
}

export type GenerateInput = Parameters<ImageProvider['generate']>[0]
// One call's answer: a picture, a failure kind, or a function the test controls.
export type Answer =
  | ImageResult
  | ProviderErrorKind
  | ((input: GenerateInput, opts?: RunOptions) => Promise<ImageResult[]>)

export const pngAnswer = (side = 3): ImageResult => ({
  bytes: greyPng(side, side),
  mime: 'image/png',
  model: 'test-model-1',
})
export const jpegAnswer = (): ImageResult => ({
  bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]),
  mime: 'image/jpeg',
  model: 'test-model-1',
})

export function makeKindFixture(opts: { toPng?: (bytes: Uint8Array) => Uint8Array } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-kind-'))
  const projects = createProjectRegistry()
  const project = createProjectFile({
    filePath: path.join(dir, 'P.adman'),
    name: 'P',
    appVersion: '0.1.0',
    now: 'x',
  })
  projects.add(project)
  seed(project.db)
  const events: BusEvent[] = []
  const log = createActivityLog({
    dir: path.join(dir, 'logs'),
    minLevel: 'debug',
    now: () => new Date(),
  })
  const calls: Array<{ input: GenerateInput; opts?: RunOptions }> = []
  const toPngCalls: Uint8Array[] = []
  const t = { answers: [] as Answer[], inFlight: 0, maxInFlight: 0 }
  const provider: ImageProvider = {
    async generate(input, runOpts) {
      calls.push({ input, opts: runOpts })
      const answer = t.answers[calls.length - 1] ?? pngAnswer()
      t.inFlight += 1
      t.maxInFlight = Math.max(t.maxInFlight, t.inFlight)
      try {
        await new Promise((r) => setTimeout(r, 2))
        if (typeof answer === 'function') return await answer(input, runOpts)
        if (typeof answer === 'string') {
          throw new ProviderFailure({ kind: answer, detail: 'Stand-in failure' })
        }
        return [answer]
      } finally {
        t.inFlight -= 1
      }
    },
    extend: () => Promise.reject(new Error('not used')),
  }
  // The agent-run settings the gate and the runner's untick check read.
  const settings = {
    current: { agentRuns: {} as Record<string, { allowed: boolean }>, agentRunLimit: 4 },
    get: () => settings.current,
  }
  const providers = [...listProviders({ ADMAN_FAKE_PROVIDERS: '1' }), PAID, NO_CANCEL]
  const deps = {
    projects,
    providers,
    settings,
    log,
    undo: createUndoLists(),
    secrets: { get: (): string | undefined => undefined },
    assets: createAssetService(),
    appVersion: '0.1.0',
    now: () => new Date('2026-11-20T14:30:00.000Z'),
    toPng: (bytes: Uint8Array) => {
      toPngCalls.push(bytes)
      return (opts.toPng ?? ((b: Uint8Array) => b))(bytes)
    },
  } as unknown as CoreDeps
  const jobs = createJobRunner({
    deps: () => deps,
    bus: () => bus,
    emit: (e) => events.push(e),
    handlers: [imageGenerationKind(() => provider)],
    cancelWaitMs: () => 2_000,
    closeWaitMs: 50,
  })
  deps.jobs = jobs
  const bus = createCommandBus({
    handlers: [
      generationRunImages(deps),
      assetAddGenerated(deps),
      assetImport(deps),
      jobCancel(deps),
    ],
    projects,
    undo: deps.undo,
    log,
    emit: (e) => events.push(e),
    askPermission: async () => false,
    agentRuns: { providers, settings },
  })
  const send = (actor: 'user' | 'agent') => (name: string, input: Record<string, unknown>) =>
    bus.execute(name, { projectId: project.projectId, ...input }, { actor })
  const user = send('user')
  const agent = send('agent')

  return {
    t,
    calls,
    toPngCalls,
    events,
    project,
    projectId: project.projectId,
    user,
    agent,
    // Sets or clears an agent tick, as a hand-edit of settings.json would.
    tick(provider: string, allowed: boolean) {
      settings.current = {
        ...settings.current,
        agentRuns: { ...settings.current.agentRuns, [provider]: { allowed } },
      }
    },
    async start(
      input: Record<string, unknown> = {},
      actor: 'user' | 'agent' = 'user',
    ): Promise<string> {
      const r = await send(actor)('generation.runImages', {
        variantId: VARIANT,
        slot: 'background',
        prompt: 'A bottle on a rock',
        referenceAssetIds: [],
        count: 3,
        provider: PAID.id,
        ...input,
      })
      if (!r.ok) throw new Error(`runImages failed: ${JSON.stringify(r.error)}`)
      return (r.data as { jobId: string }).jobId
    },
    job: (id: string) => readWireRow(project.db, 'job', { id }) as JobRow | null,
    assets: () => readWireRows(project.db, 'asset') as AssetRow[],
    assetsDir: () => deps.assets.assetsDir(project),
    files: () => {
      const d = deps.assets.assetsDir(project)
      return fs.existsSync(d) ? fs.readdirSync(d).sort() : []
    },
    jobEvents: (id: string) =>
      events.flatMap((e) => (e.name === 'job.updated' && e.payload.id === id ? [e.payload] : [])),
    root: dir,
    cleanup() {
      if (projects.remove(project.projectId)) closeProjectFile(project)
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

export type KindFixture = ReturnType<typeof makeKindFixture>

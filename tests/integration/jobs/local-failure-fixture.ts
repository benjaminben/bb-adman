// Test harness for P4-5 (spec/ai-jobs.md "A plain sentence per failure cause", OI-68): one
// real project file, the real runner, AssetService and bus, a stand-in picture provider that
// needs a key, a key store the test can empty, and a switch that makes asset.addGenerated
// refuse through a stand-in bus. Four holder jobs keep the provider's places, so the job
// under test stays queued while the test breaks something. Not a test file itself.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createProjectFile, closeProjectFile } from '@/main/db/project-file'
import { createProjectRegistry } from '@/main/db/project-registry'
import { readJobErrorDetail, readWireRow } from '@/main/db/rows'
import { createCommandBus } from '@/main/commands/bus'
import { createUndoLists } from '@/main/history/undo-lists'
import { createActivityLog } from '@/main/log/activity-log'
import { createAssetService } from '@/main/assets/service'
import { listProviders } from '@/main/providers/registry'
import { createJobRunner } from '@/main/jobs/runner'
import { assetAddGenerated } from '@/main/commands/asset/add-generated'
import { assetImport } from '@/main/commands/asset/import'
import { generationRunImages } from '@/main/commands/generation/run-images'
import { imageGenerationKind } from '@/main/jobs/kinds/image-generation'
import { greyPng } from '@/main/providers/fake/png'
import type { ImageProvider } from '@/main/providers/types'
import type { CoreDeps } from '@/main/core-deps'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'
import { JOBS_AT_ONCE_PER_PROVIDER } from '@/shared/config/job-kinds'
import { fail, type AppError } from '@/shared/schemas/result'
import { seed, VARIANT } from '../generation/generation-fixture'

export const KEYED: ProviderInfo = {
  id: 'keyed-test',
  label: 'Keyed Test',
  jobs: ['image'],
  available: true,
  secrets: ['gemini.apiKey'],
  defaultModels: { image: 'test-model-1' },
  local: false,
  cancel: 'stops',
  serverText: false,
}

// What the stand-in bus answers for asset.addGenerated: a path and a code that must not leave.
export const REFUSAL = {
  code: 'PROJECT_LOCKED' as const,
  message: 'Refused at /Users/someone/secret-folder/results.db',
  details: { reason: 'stand_in_refusal' },
}

export function makeLocalFailureFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-local-'))
  const projects = createProjectRegistry()
  const project = createProjectFile({
    filePath: path.join(dir, 'P.adman'),
    name: 'P',
    appVersion: '0.1.0',
    now: 'x',
  })
  projects.add(project)
  seed(project.db)
  const log = createActivityLog({
    dir: path.join(dir, 'logs'),
    minLevel: 'debug',
    now: () => new Date(),
  })
  const keys = new Map<string, string>([['gemini.apiKey', 'k-123']])
  const t = { refuseAdd: false, readError: null as AppError | null }
  let open = () => {}
  const gate = new Promise<void>((r) => (open = r))
  let calls = 0
  const provider: ImageProvider = {
    async generate() {
      calls += 1
      if (calls <= JOBS_AT_ONCE_PER_PROVIDER) await gate
      return [{ bytes: greyPng(3, 3), mime: 'image/png', model: 'test-model-1' }]
    },
    extend: () => Promise.reject(new Error('not used')),
  }
  const assets = createAssetService()
  const settings = { get: () => ({ agentRuns: {}, agentRunLimit: 4 }) }
  const providers = [...listProviders({ ADMAN_FAKE_PROVIDERS: '1' }), KEYED]
  const deps = {
    projects,
    providers,
    settings,
    log,
    undo: createUndoLists(),
    secrets: { get: (name: string) => keys.get(name) },
    assets: {
      ...assets,
      read: (p: Parameters<typeof assets.read>[0], id: string) =>
        t.readError ? Promise.reject(t.readError) : assets.read(p, id),
    },
    appVersion: '0.1.0',
    now: () => new Date('2026-11-20T14:30:00.000Z'),
    toPng: (bytes: Uint8Array) => bytes,
  } as unknown as CoreDeps
  const bus = createCommandBus({
    handlers: [generationRunImages(deps), assetAddGenerated(deps), assetImport(deps)],
    projects,
    undo: deps.undo,
    log,
    emit: () => undefined,
    askPermission: async () => false,
    agentRuns: { providers, settings },
  })
  // The stand-in bus refuses asset.addGenerated and passes everything else on.
  const standIn: typeof bus = {
    execute: (name, input, opts) =>
      t.refuseAdd && name === 'asset.addGenerated'
        ? Promise.resolve(fail(REFUSAL))
        : bus.execute(name, input, opts),
  }
  deps.jobs = createJobRunner({
    deps: () => deps,
    bus: () => standIn,
    emit: () => undefined,
    handlers: [imageGenerationKind(() => provider)],
    cancelWaitMs: () => 2_000,
    closeWaitMs: 50,
  })
  const user = (name: string, input: Record<string, unknown>) =>
    bus.execute(name, { projectId: project.projectId, ...input }, { actor: 'user' })
  const start = async (input: Record<string, unknown> = {}) => {
    const r = await user('generation.runImages', {
      variantId: VARIANT,
      slot: 'background',
      prompt: 'A bottle on a rock',
      referenceAssetIds: [],
      count: 1,
      provider: KEYED.id,
      ...input,
    })
    if (!r.ok) throw new Error(`runImages failed: ${r.error.code}`)
    return (r.data as { jobId: string }).jobId
  }

  return {
    t,
    keys,
    project,
    root: dir,
    user,
    start,
    // Starts the holders, then the job under test, which stays queued until release().
    async queued(input: Record<string, unknown> = {}) {
      const holders = await Promise.all(
        Array.from({ length: JOBS_AT_ONCE_PER_PROVIDER }, () => start()),
      )
      const id = await start(input)
      return { id, holders }
    },
    release: () => open(),
    job: (id: string) => readWireRow(project.db, 'job', { id }) as JobRow | null,
    errorDetail: (id: string) => readJobErrorDetail(project.db, id),
    assetsDir: () => deps.assets.assetsDir(project),
    // Every line of every file in the test's log folder.
    logLines() {
      const logDir = path.join(dir, 'logs')
      if (!fs.existsSync(logDir)) return []
      return fs
        .readdirSync(logDir)
        .flatMap((n) => fs.readFileSync(path.join(logDir, n), 'utf8').split('\n'))
        .filter((l) => l.trim() !== '')
    },
    cleanup() {
      if (projects.remove(project.projectId)) closeProjectFile(project)
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

export type LocalFailureFixture = ReturnType<typeof makeLocalFailureFixture>

// P7-13 (A-174; Phase 7 exit criterion 4): a graceful close leaves a started paid video run
// running, and the next open of that project collects the clip. Through the real core and
// video job kind, with the fake video adapter behind a stand-in registry row that is paid
// (local false) and whose cancel is may_finish. A run still waiting, or with no remote ID yet,
// is asked to stop as before; project.package still writes such a row cancelled in the copy.
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  makeGenerationFixture,
  waitFor,
  ended,
  type GenerationFixture,
} from '../generation/generation-fixture'
import { adapters as fakeAdapters } from '@/main/providers/fake'
import { fakeVideo } from '@/main/providers/fake/video'
import { resetFakeBehaviour, setFakeBehaviour } from '@/main/providers/fake/behaviour'
import { ProviderCancelled, type VideoProvider } from '@/main/providers/types'
import { readWireRow, readWireRows } from '@/main/db/rows'
import type { ProjectContext } from '@/main/commands/types'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { VideoJobRequest } from '@/shared/schemas/jobs/video-generation'

let f: GenerationFixture
afterEach(() => {
  f.cleanup()
  vi.restoreAllMocks()
  resetFakeBehaviour()
})

const RUN_MS = 15_000
const request: VideoJobRequest = {
  prompt: 'Waves at dusk',
  durationMs: 2_000,
  width: 1080,
  height: 1920,
  start: 'none',
  referenceAssetIds: [],
}

// The fake's registry row, made paid and may_finish, as a fal row will be.
function paidStandIn(): void {
  const i = f.core.deps.providers.findIndex((p) => p.id === 'fake')
  const fake = f.core.deps.providers[i]
  if (!fake) throw new Error('no fake provider row')
  f.core.deps.providers[i] = { ...fake, label: 'Charge Test', local: false, cancel: 'may_finish' }
}

// The fake's video part, with its calls counted and its check or start changed if asked.
function watched(change: Partial<VideoProvider> = {}) {
  const calls = { start: 0, check: 0, cancel: 0 }
  vi.spyOn(fakeAdapters, 'video').mockImplementation(() => {
    const real = { ...fakeVideo(), ...change }
    return {
      ...real,
      start: (input, opts) => (calls.start++, real.start(input, opts)),
      check: (id) => (calls.check++, real.check(id)),
      cancel: (id) => (calls.cancel++, real.cancel(id)),
    }
  })
  return calls
}

function enqueue(): string {
  const ctx = { project: f.project } as unknown as ProjectContext
  return f.core.deps.jobs.enqueue(ctx, {
    kind: 'video_generation',
    campaignId: 'c1',
    variantId: 'v1',
    layerId: null,
    slot: null,
    provider: 'fake',
    model: '',
    request,
    startedBy: 'user',
  })
}

const stageIs = (id: string, stage: string) => () =>
  (f.job(id)?.result as { stage?: string } | null)?.stage === stage

// The job row as the closed file holds it.
function rowInFile(file: string, id: string): JobRow | null {
  const db = new Database(file, { readonly: true })
  try {
    return readWireRow(db, 'job', { id }) as JobRow | null
  } finally {
    db.close()
  }
}

// A row as a file from elsewhere could hold it, claiming the close left it running.
function crafted(id: string, status: string, remoteJobId: string | null, provider = 'fake') {
  f.db
    .prepare(
      `INSERT INTO job (id, kind, status, provider, model, request, remote_job_id, result,
         campaign_id, variant_id, created_at, updated_at)
       VALUES (?, 'video_generation', ?, ?, '', ?, ?, ?, 'c1', 'v1',
         '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    )
    .run(
      id,
      status,
      provider,
      JSON.stringify(request),
      remoteJobId,
      JSON.stringify({ stage: 'working', leftRunning: true }),
    )
}

const close = () => f.user('project.close', { runningJobs: 'stop' })
const open = (filePath: string) =>
  f.core.bus.execute('project.open', { filePath }, { actor: 'user' })

// Every file under the app's own folder (logs and settings), as one text.
function appFilesText(): string {
  const dir = path.join(f.root, 'userData')
  if (!fs.existsSync(dir)) return ''
  return fs
    .readdirSync(dir, { recursive: true })
    .map((p) => path.join(dir, String(p)))
    .filter((p) => fs.statSync(p).isFile())
    .map((p) => fs.readFileSync(p, 'utf8'))
    .join('')
}

describe('a close leaves a started paid run running [P7-13, A-174]', () => {
  it('working: the row stays running, another project does not touch it, a reopen collects the clip', async () => {
    f = await makeGenerationFixture()
    paidStandIn()
    setFakeBehaviour({ waitMs: 3_000 })
    const calls = watched()
    const filePath = f.project.filePath
    const id = enqueue()
    await waitFor(stageIs(id, 'working'), RUN_MS)
    const remoteJobId = f.job(id)?.remoteJobId ?? ''
    expect(remoteJobId).toMatch(/^fake-video-v1-/)

    expect(await close()).toMatchObject({ ok: true })
    expect(calls.cancel).toBe(0)
    expect(rowInFile(filePath, id)).toMatchObject({
      status: 'running',
      remoteJobId,
      paidCalls: 1,
      result: { stage: 'working', leftRunning: true },
    })

    const other = await f.core.bus.execute(
      'project.create',
      { name: 'Other', location: path.join(f.root) },
      { actor: 'user' },
    )
    expect(other).toMatchObject({ ok: true })
    const startsBefore = calls.start
    const checksBefore = calls.check
    await new Promise((r) => setTimeout(r, 2_500))
    expect(calls.check).toBe(checksBefore)
    expect(rowInFile(filePath, id)).toMatchObject({ status: 'running' })

    expect(await open(filePath)).toMatchObject({ ok: true })
    const handle = f.core.projects.findByPath(filePath)
    if (!handle) throw new Error('not open again')
    const row = () => readWireRow(handle.db, 'job', { id }) as JobRow | null
    await waitFor(() => row()?.status === 'succeeded', RUN_MS)
    expect(row()).toMatchObject({ paidCalls: 1, remoteJobId })
    expect(calls.start).toBe(startsBefore)
    expect(calls.cancel).toBe(0)
    expect(readWireRows(handle.db, 'asset')).toHaveLength(1)
    expect(appFilesText()).not.toContain(remoteJobId)
  }, 30_000)

  it('working, reopened at once: the clip is stored once', async () => {
    f = await makeGenerationFixture()
    paidStandIn()
    setFakeBehaviour({ waitMs: 2_500 })
    watched()
    const filePath = f.project.filePath
    const id = enqueue()
    await waitFor(stageIs(id, 'working'), RUN_MS)
    expect(await close()).toMatchObject({ ok: true })
    expect(await open(filePath)).toMatchObject({ ok: true })
    const handle = f.core.projects.findByPath(filePath)
    if (!handle) throw new Error('not open again')
    await waitFor(() => readWireRow(handle.db, 'job', { id })?.status === 'succeeded', RUN_MS)
    await new Promise((r) => setTimeout(r, 2_500))
    expect(readWireRows(handle.db, 'asset')).toHaveLength(1)
    const assetsDir = f.core.deps.assets.assetsDir(handle)
    expect(fs.readdirSync(assetsDir).filter((n) => n.endsWith('.mp4'))).toHaveLength(1)
  }, 30_000)

  it('waiting: the run is asked to stop as before and ends cancelled', async () => {
    f = await makeGenerationFixture()
    paidStandIn()
    setFakeBehaviour({ waitMs: 60_000 })
    const calls = watched({ check: async () => ({ status: 'waiting', queuePosition: 2 }) })
    const filePath = f.project.filePath
    const id = enqueue()
    await waitFor(stageIs(id, 'waiting'), RUN_MS)
    expect(await close()).toMatchObject({ ok: true })
    expect(calls.cancel).toBe(1)
    expect(rowInFile(filePath, id)).toMatchObject({ status: 'cancelled' })
  }, 30_000)

  it('no remote ID yet: the run is asked to stop as before and ends cancelled', async () => {
    f = await makeGenerationFixture()
    paidStandIn()
    let startCalled = false
    watched({
      start: (_input, opts) =>
        new Promise((_done, fail) => {
          startCalled = true
          opts?.signal?.addEventListener('abort', () => fail(new ProviderCancelled()))
        }),
    })
    const filePath = f.project.filePath
    const id = enqueue()
    await waitFor(() => startCalled, RUN_MS)
    expect(await close()).toMatchObject({ ok: true })
    expect(rowInFile(filePath, id)).toMatchObject({ status: 'cancelled', remoteJobId: null })
  }, 30_000)

  it('project.package writes a left-running row cancelled in the copy', async () => {
    f = await makeGenerationFixture()
    crafted('j-left', 'running', 'fake-video-v1-1700000000000-0-64x64-1000')
    const targetDir = path.join(f.root, 'packed')
    fs.mkdirSync(targetDir)
    expect(await f.user('project.package', { targetDir })).toMatchObject({ ok: true })
    const copy = fs
      .readdirSync(targetDir, { recursive: true })
      .map(String)
      .find((p) => p.endsWith('.adman'))
    if (!copy) throw new Error('no copy made')
    expect(rowInFile(path.join(targetDir, copy), 'j-left')).toMatchObject({ status: 'cancelled' })
    expect(f.job('j-left')).toMatchObject({ status: 'running' })
  }, 30_000)

  it('a crafted row that claims it was left running gets only the open rule every row gets', async () => {
    f = await makeGenerationFixture()
    paidStandIn()
    const calls = watched()
    crafted('j-queued', 'queued', null)
    crafted('j-no-id', 'running', null)
    crafted('j-bad-id', 'running', 'fake-video-v1-1700000000000-0-64x64-1000/../x')
    crafted('j-other', 'running', 'fake-video-v1-1700000000000-0-64x64-1000', 'gemini')
    await f.core.deps.jobs.projectOpened(f.projectId)
    await waitFor(ended(f, 'j-bad-id'), RUN_MS)
    await waitFor(ended(f, 'j-other'), RUN_MS)
    expect(f.job('j-queued')).toMatchObject({ status: 'cancelled' })
    expect(f.job('j-no-id')).toMatchObject({ status: 'failed', errorKind: 'other' })
    expect(f.job('j-bad-id')).toMatchObject({ status: 'failed', errorKind: 'other' })
    expect(f.job('j-other')).toMatchObject({ status: 'failed' })
    expect(f.jobs().map((j) => j.paidCalls)).toEqual([0, 0, 0, 0])
    expect(calls.start).toBe(0)
    expect(readWireRows(f.db, 'asset')).toHaveLength(0)
    expect(appFilesText()).not.toContain('/../x')
  }, 30_000)
})

// P7-16 (with P7-13 leaveRunning): once a close lets a started paid video run go, the old
// handler stops polling and sends nothing more to the provider, even when the project is
// opened again at once; only the next open's pick-up collects the clip.
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  makeGenerationFixture,
  waitFor,
  type GenerationFixture,
} from '../generation/generation-fixture'
import { adapters as fakeAdapters } from '@/main/providers/fake'
import { fakeVideo } from '@/main/providers/fake/video'
import { resetFakeBehaviour, setFakeBehaviour } from '@/main/providers/fake/behaviour'
import { readWireRow, readWireRows } from '@/main/db/rows'
import type { ProjectContext } from '@/main/commands/types'
import type { JobRow } from '@/shared/schemas/rows/job'

let f: GenerationFixture
afterEach(() => {
  f.cleanup()
  vi.restoreAllMocks()
  resetFakeBehaviour()
})

const RUN_MS = 15_000
type Calls = { start: number; check: number; fetch: number; cancel: number }

// Each adapter the job kind makes (one per handler run), with its own calls counted.
function perHandler(): Calls[] {
  const made: Calls[] = []
  vi.spyOn(fakeAdapters, 'video').mockImplementation(() => {
    const real = fakeVideo()
    const calls = { start: 0, check: 0, fetch: 0, cancel: 0 }
    made.push(calls)
    return {
      ...real,
      start: (input, opts) => (calls.start++, real.start(input, opts)),
      check: (id) => (calls.check++, real.check(id)),
      fetchResult: (id) => (calls.fetch++, real.fetchResult(id)),
      cancel: (id) => (calls.cancel++, real.cancel(id)),
    }
  })
  return made
}

describe('a let-go video job stops its old handler [P7-16]', () => {
  it('after a close leaves a run running, the old handler makes no further provider call', async () => {
    f = await makeGenerationFixture()
    const i = f.core.deps.providers.findIndex((p) => p.id === 'fake')
    const fake = f.core.deps.providers[i]
    if (!fake) throw new Error('no fake provider row')
    f.core.deps.providers[i] = { ...fake, local: false, cancel: 'may_finish' }
    setFakeBehaviour({ waitMs: 3_000 })
    const made = perHandler()
    const ctx = { project: f.project } as unknown as ProjectContext
    const id = f.core.deps.jobs.enqueue(ctx, {
      kind: 'video_generation',
      campaignId: 'c1',
      variantId: 'v1',
      layerId: null,
      slot: null,
      provider: 'fake',
      model: '',
      request: {
        prompt: 'Waves',
        durationMs: 2_000,
        width: 1080,
        height: 1350,
        start: 'none',
        referenceAssetIds: [],
      },
      startedBy: 'user',
    })
    const working = () => (f.job(id)?.result as { stage?: string } | null)?.stage === 'working'
    await waitFor(working, RUN_MS)
    const filePath = f.project.filePath
    expect(await f.user('project.close', { runningJobs: 'stop' })).toMatchObject({ ok: true })
    const old = made[0]
    if (!old) throw new Error('no handler ran')
    const atClose = { ...old }
    expect(await f.core.bus.execute('project.open', { filePath }, { actor: 'user' })).toMatchObject(
      {
        ok: true,
      },
    )
    const handle = f.core.projects.findByPath(filePath)
    if (!handle) throw new Error('not open again')
    await waitFor(() => readWireRow(handle.db, 'job', { id })?.status === 'succeeded', RUN_MS)
    await new Promise((r) => setTimeout(r, 2_500))
    expect(old).toEqual(atClose)
    expect(made).toHaveLength(2)
    expect(made[1]).toMatchObject({ start: 0, fetch: 1, cancel: 0 })
    const row = readWireRow(handle.db, 'job', { id }) as JobRow
    expect(row.paidCalls).toBe(1)
    expect(readWireRows(handle.db, 'asset')).toHaveLength(1)
    expect(readWireRows(handle.db, 'background_clip')).toHaveLength(1)
  }, 30_000)
})

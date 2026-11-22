// P7-15 (phase-07 "fal.ai Seedance", A-170 to A-174; security class full): fal.ai Seedance is
// switched on. A user start goes through the real core, the real video job kind and the real
// fal adapter, whose fetch is a recorded-answer stand-in. Only the submit is a paid call; a
// picked-up row adds none; a cancel while the run waits sends the queue cancel; a cancel once
// the run works is refused, since it would still be charged.
import Database from 'better-sqlite3'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { waitFor, ended } from './generation-fixture'
import { data } from '../core-fixture'
import { readWireRow, readWireRows } from '@/main/db/rows'
import type { JobRow } from '@/shared/schemas/rows/job'
import {
  COMPLETED,
  FAL_KEY,
  IN_PROGRESS,
  IN_QUEUE,
  REQUEST_ID,
  ask,
  calls,
  falWorld,
  stageIs,
  startFal,
  statusCalls,
  type FalWorld,
} from './fal-fixture'

let w: FalWorld
afterEach(() => {
  w.f.cleanup()
  vi.restoreAllMocks()
})

const RUN_MS = 15_000
const cancel = (id: string) => w.f.user('job.cancel', { jobId: id })

describe('a user start with fal.ai Seedance [P7-15]', () => {
  it('is enqueued; paid_calls is 1 after the submit and stays 1 after the status calls', async () => {
    w = await falWorld()
    const { jobId } = data<{ jobId: string }>(await startFal(w))
    expect(w.f.job(jobId)).toMatchObject({
      kind: 'video_generation',
      provider: 'fal-seedance',
      startedBy: 'user',
    })
    await waitFor(() => w.f.job(jobId)?.remoteJobId === REQUEST_ID, RUN_MS)
    expect(w.f.job(jobId)?.paidCalls).toBe(1)
    await waitFor(() => statusCalls(w).length >= 2, RUN_MS)
    expect(w.f.job(jobId)?.paidCalls).toBe(1)
    w.status.now = COMPLETED
    await waitFor(ended(w.f, jobId), RUN_MS)
    expect(w.f.job(jobId)).toMatchObject({ status: 'succeeded', paidCalls: 1 })
    expect(calls(w, 'POST')).toHaveLength(1)
    expect(readWireRows(w.f.db, 'asset')).toHaveLength(1)
    expect(w.globalFetch).not.toHaveBeenCalled()
  }, 30_000)

  it('sends the key only to the queue host, asks for no redirect to be followed, and keeps it out of rows and events', async () => {
    w = await falWorld()
    w.status.now = COMPLETED
    const { jobId } = data<{ jobId: string }>(await startFal(w))
    await waitFor(ended(w.f, jobId), RUN_MS)
    expect(w.seen.length).toBeGreaterThanOrEqual(4)
    for (const s of w.seen) {
      const queue = new URL(s.url).origin === 'https://queue.fal.run'
      expect(s.headers.get('authorization')).toBe(queue ? `Key ${FAL_KEY}` : null)
      expect(s.redirect).toBe('manual')
    }
    const text = JSON.stringify([w.f.jobs(), w.f.events, readWireRows(w.f.db, 'asset')])
    expect(text).not.toContain(FAL_KEY)
  }, 30_000)

  it('a picked-up row is only checked and fetched, and adds no paid call', async () => {
    w = await falWorld()
    w.status.now = COMPLETED
    const filePath = w.f.project.filePath
    expect(await w.f.user('project.close', {})).toMatchObject({ ok: true })
    const db = new Database(filePath)
    db.prepare(
      `INSERT INTO job (id, kind, status, provider, model, request, remote_job_id, result,
         campaign_id, variant_id, created_at, updated_at)
       VALUES ('j-left', 'video_generation', 'running', 'fal-seedance', '', ?, ?, ?, 'c1', 'v1',
         '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    ).run(
      JSON.stringify({ ...ask, width: 1080, height: 1350 }),
      REQUEST_ID,
      JSON.stringify({ stage: 'working', leftRunning: true }),
    )
    db.close()
    const opened = await w.f.core.bus.execute('project.open', { filePath }, { actor: 'user' })
    expect(opened).toMatchObject({ ok: true })
    const handle = w.f.core.projects.findByPath(filePath)
    if (!handle) throw new Error('not open again')
    const row = () => readWireRow(handle.db, 'job', { id: 'j-left' }) as JobRow | null
    await waitFor(() => row()?.status === 'succeeded', RUN_MS)
    expect(row()?.paidCalls).toBe(0)
    expect(calls(w, 'POST')).toEqual([])
    expect(statusCalls(w).length).toBeGreaterThanOrEqual(1)
  }, 30_000)
})

describe('cancelling a fal run [P7-13, P7-15]', () => {
  it('while it waits in the queue sends the queue cancel once and ends cancelled', async () => {
    w = await falWorld()
    w.status.now = IN_QUEUE
    const { jobId } = data<{ jobId: string }>(await startFal(w))
    await waitFor(stageIs(w, jobId, 'waiting'), RUN_MS)
    expect(await cancel(jobId)).toMatchObject({ ok: true })
    await waitFor(ended(w.f, jobId), RUN_MS)
    expect(w.f.job(jobId)).toMatchObject({ status: 'cancelled', paidCalls: 1 })
    const [sent, ...more] = calls(w, 'PUT')
    expect(more).toEqual([])
    expect(sent?.url).toBe(
      `https://queue.fal.run/bytedance/seedance-2.0/requests/${REQUEST_ID}/cancel`,
    )
  }, 30_000)

  it('once it works is refused with cancel_would_still_charge and sends nothing', async () => {
    w = await falWorld()
    w.status.now = IN_PROGRESS
    const { jobId } = data<{ jobId: string }>(await startFal(w))
    await waitFor(stageIs(w, jobId, 'working'), RUN_MS)
    expect(await cancel(jobId)).toMatchObject({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message:
          'fal.ai Seedance has started this and will charge for it. The app lets it finish and keeps the result.',
        details: { reason: 'cancel_would_still_charge' },
      },
    })
    w.status.now = COMPLETED
    await waitFor(ended(w.f, jobId), RUN_MS)
    expect(w.f.job(jobId)?.status).toBe('succeeded')
    expect(calls(w, 'PUT')).toEqual([])
  }, 30_000)
})

// CU-6a: the ComfyUI video adapter's check and cancel against the stand-in (SPEC 6.10.6 step
// 6, 6.10.9, 6.11.2, 14 1.43 K-7). check looks once per call; the job kind calls it on a timer.
import { describe, it, expect, afterEach } from 'vitest'
import { startComfyStandIn, type StandIn } from '../../../../helpers/comfy-stand-in'
import {
  PROMPT_ID,
  comfyContext,
  fakeTiming,
  finishRun,
  requestLines,
  serveNeeds,
} from '../../../../helpers/comfy-run'
import { comfyVideo } from '../../../../../src/main/providers/comfyui/video'
import { createServerChecks } from '../../../../../src/main/providers/comfyui/needs'
import { LOST_CONTACT_MS, VIDEO_WORK_MS } from '../../../../../src/main/providers/comfyui/limits'

let stand: StandIn
afterEach(async () => {
  await stand.close()
})

const input = { image: null, references: [], prompt: 'p', durationMs: 2_000, width: 64, height: 64 }

async function started(origin?: () => string | null) {
  stand = await startComfyStandIn()
  serveNeeds(stand)
  const { timing } = fakeTiming()
  const v = comfyVideo(comfyContext(origin ?? (() => stand.origin)), {
    timing,
    checks: createServerChecks(),
  })
  const { remoteJobId } = await v.start(input)
  return { v, id: remoteJobId, timing }
}

const posts = () => stand.seen.filter((r) => r.method === 'POST' && r.path !== '/prompt')
const errorEntry = (type: string, message: string, kind = 'execution_error') => ({
  status: {
    status_str: kind === 'execution_error' ? 'error' : 'success',
    completed: false,
    messages: [[kind, { exception_type: type, exception_message: message, traceback: ['/srv'] }]],
  },
  outputs: {},
})

describe('ComfyUI video check [SPEC 6.10.6 step 6, 6.10.9]', () => {
  it('waiting, with its place in the queue', async () => {
    const { v, id } = await started()
    stand.reply(`GET /api/jobs/${id}`, { status: 404, json: {} })
    stand.reply('GET /queue', {
      json: {
        queue_running: [],
        queue_pending: [
          [1, 'a1b2'],
          [2, id],
        ],
      },
    })
    expect(await v.check(id)).toEqual({ status: 'waiting', queuePosition: 2 })
  })

  it('running while the server works on it', async () => {
    const { v, id } = await started()
    stand.reply(`GET /api/jobs/${id}`, { json: { status: 'in_progress' } })
    expect(await v.check(id)).toEqual({ status: 'running' })
  })

  it('a run the server ended out of memory: failed, out_of_memory', async () => {
    const { v, id } = await started()
    finishRun(stand, id, errorEntry('torch.OutOfMemoryError', 'CUDA out of memory'))
    expect(await v.check(id)).toMatchObject({
      status: 'failed',
      error: { kind: 'other', reason: 'out_of_memory' },
    })
  })

  it('in neither the queue nor the history twice in a row: server_stopped', async () => {
    const { v, id } = await started()
    stand.reply(`GET /api/jobs/${id}`, { status: 404, json: {} })
    expect((await v.check(id)).status).toBe('waiting')
    expect(await v.check(id)).toMatchObject({
      status: 'failed',
      error: { reason: 'server_stopped' },
    })
  })

  it('a failed poll is not a failure; 5 minutes of them is lost_contact', async () => {
    const { v, id, timing } = await started()
    stand.reply(`GET /api/jobs/${id}`, { json: { status: 'in_progress' } })
    expect((await v.check(id)).status).toBe('running')
    stand.reply(`GET /history/${id}`, { vanish: true })
    expect((await v.check(id)).status).toBe('running')
    await timing.sleep(LOST_CONTACT_MS)
    expect(await v.check(id)).toMatchObject({
      status: 'failed',
      error: { kind: 'offline', reason: 'lost_contact' },
    })
  })

  it('over the video working limit: too_long, kind timeout', async () => {
    const { v, id, timing } = await started()
    stand.reply(`GET /api/jobs/${id}`, { json: { status: 'in_progress' } })
    expect((await v.check(id)).status).toBe('running')
    await timing.sleep(VIDEO_WORK_MS - 1_000)
    expect((await v.check(id)).status).toBe('running')
    await timing.sleep(2_000)
    expect(await v.check(id)).toMatchObject({
      status: 'failed',
      error: { kind: 'timeout', reason: 'too_long' },
    })
  })

  it('the address changed: address_changed, and nothing more is sent', async () => {
    let origin: string | null = null
    const { v, id } = await started(() => origin ?? stand.origin)
    const before = stand.seen.length
    origin = 'http://127.0.0.1:1'
    expect(await v.check(id)).toMatchObject({
      status: 'failed',
      error: { reason: 'address_changed' },
    })
    expect(await v.cancel(id)).toBe('unknown')
    expect(stand.seen.length).toBe(before)
  })

  it('an ID this adapter did not start is not asked about (1.40)', async () => {
    const { v } = await started()
    const before = stand.seen.length
    const foreign = '3b9e1c2d-5f6a-4b7c-8d9e-0f1a2b3c4d5e'
    expect((await v.check(foreign)).status).toBe('failed')
    expect(stand.seen.length).toBe(before)
  })
})

describe('ComfyUI video cancel [SPEC 6.11.2, 14 1.43 K-7] (security class)', () => {
  it('removes its own queued run from the queue, by its ID only', async () => {
    const { v, id } = await started()
    stand.reply('GET /queue', { json: { queue_running: [], queue_pending: [[1, id]] } })
    expect(await v.cancel(id)).toBe('stopped')
    expect(posts().map((r) => [r.path, JSON.parse(r.body.toString('utf8'))])).toEqual([
      ['/queue', { delete: [PROMPT_ID] }],
    ])
  })

  it('interrupts its own running run by its ID', async () => {
    const { v, id } = await started()
    stand.reply('GET /queue', { json: { queue_running: [[1, id]], queue_pending: [] } })
    expect(await v.cancel(id)).toBe('stopped')
    expect(posts().map((r) => r.path)).toEqual(['/interrupt'])
  })

  it('an interrupted run after a cancel reads cancelled, not failed', async () => {
    const { v, id } = await started()
    stand.reply('GET /queue', { json: { queue_running: [[1, id]], queue_pending: [] } })
    await v.cancel(id)
    finishRun(stand, id, errorEntry('', '', 'execution_interrupted'))
    expect((await v.check(id)).status).toBe('cancelled')
  })

  it('an interrupted run nobody here cancelled: failed, server_stopped', async () => {
    const { v, id } = await started()
    finishRun(stand, id, errorEntry('', '', 'execution_interrupted'))
    expect(await v.check(id)).toMatchObject({
      status: 'failed',
      error: { reason: 'server_stopped' },
    })
  })

  it('sends nothing for an ID it did not start, and answers unknown', async () => {
    const { v } = await started()
    const before = stand.seen.length
    expect(await v.cancel('3b9e1c2d-5f6a-4b7c-8d9e-0f1a2b3c4d5e')).toBe('unknown')
    expect(stand.seen.length).toBe(before)
    expect(requestLines(stand).filter((l) => l === 'POST /queue')).toEqual([])
  })
})

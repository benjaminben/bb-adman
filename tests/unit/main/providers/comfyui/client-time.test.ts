import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import http, { type ClientRequest } from 'node:http'
import {
  createComfyClient,
  type ComfyClient,
} from '../../../../../src/main/providers/comfyui/client'
import {
  CONNECT_MS,
  DOWNLOAD_MS,
  SHORT_CALL_MS,
  UPLOAD_MS,
} from '../../../../../src/main/providers/comfyui/limits'
import { uploadName } from '../../../../../src/main/providers/comfyui/values'
import { startComfyStandIn, type StandIn } from '../../../../helpers/comfy-stand-in'
import { failureOf } from '../../../../helpers/failure-of'

let standIn: StandIn
let client: ComfyClient

beforeEach(async () => {
  standIn = await startComfyStandIn()
  client = createComfyClient({ origin: standIn.origin, ownPorts: () => [9100] })
})
afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  await standIn.close()
})

// Starts the call, and waits until its answer has begun to arrive. The outcome is wrapped so
// that returning it does not wait for it.
async function startedAnswer(run: () => Promise<unknown>) {
  const spy = vi.spyOn(http, 'request')
  vi.useFakeTimers({ toFake: ['setTimeout'] })
  const outcome = failureOf(run())
  const req = spy.mock.results[0]?.value as ClientRequest
  await new Promise((done) => req.once('response', done))
  return { outcome }
}

async function stillWaiting(outcome: Promise<unknown>): Promise<boolean> {
  const marker = Symbol('waiting')
  const first = await Promise.race([outcome, new Promise((done) => setImmediate(done, marker))])
  return first === marker
}

describe('time limits of a call [SPEC 6.10.2, 14 CU-2]', () => {
  it('no answer within 10 s of the request being sent is offline, no_answer', async () => {
    standIn.reply('GET /system_stats', { wait: true })
    const spy = vi.spyOn(http, 'request')
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const outcome = failureOf(client.systemStats())
    const req = spy.mock.results[0]?.value as ClientRequest
    await new Promise((done) => req.once('finish', done))
    await vi.advanceTimersByTimeAsync(CONNECT_MS - 1)
    expect(await stillWaiting(outcome)).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(await outcome).toEqual({
      kind: 'offline',
      reason: 'no_answer',
      detail: 'No answer within the connect wait',
    })
  })

  it.each([
    ['a short call', SHORT_CALL_MS, 'GET /system_stats', () => client.systemStats()],
    [
      'an upload',
      UPLOAD_MS,
      'POST /upload/image',
      () => client.uploadImage(uploadName(new Uint8Array([1])), new Uint8Array([1])),
    ],
    [
      'a download',
      DOWNLOAD_MS,
      'GET /view',
      () => client.viewFile({ filename: 'a.png', subfolder: '', type: 'temp' }, 100),
    ],
  ])('%s that has begun to answer stops at its own limit', async (_n, limit, route, run) => {
    standIn.reply(route, { stall: true })
    const { outcome } = await startedAnswer(run)
    await vi.advanceTimersByTimeAsync(limit - 1)
    expect(await stillWaiting(outcome)).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(await outcome).toEqual({
      kind: 'offline',
      reason: 'no_answer',
      detail: 'The call went over its time limit',
    })
  })
})

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import http, { type ClientRequest } from 'node:http'
import net, { type AddressInfo } from 'node:net'
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

// A server that takes no body until it is released, so the upload cannot finish sending.
// Once released it reads the whole body, then answers like ComfyUI or, when silent, never.
async function slowReader(silent = false) {
  let release = () => {}
  let seen = () => {}
  let taken = () => {}
  const wasSeen = new Promise<void>((done) => (seen = done))
  const wasTaken = new Promise<void>((done) => (taken = done))
  const server = http.createServer((req, res) => {
    req.pause()
    seen()
    release = () => {
      req.on('data', () => {})
      req.on('end', () => {
        taken()
        if (!silent) res.end(JSON.stringify({ name: 'kept.png', subfolder: 'adman', type: 'input' }))
      })
      req.resume()
    }
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const { port } = server.address() as AddressInfo
  const close = () => {
    server.closeAllConnections()
    return new Promise((done) => server.close(done))
  }
  return { origin: `http://127.0.0.1:${port}`, wasSeen, wasTaken, release: () => release(), close }
}

// Large enough that the socket's buffers fill while the server takes nothing.
const BIG = new Uint8Array(32 * 1024 * 1024)

function slowUpload(origin: string) {
  const c = createComfyClient({ origin, ownPorts: () => [9100] })
  vi.useFakeTimers({ toFake: ['setTimeout'] })
  return c.uploadImage(uploadName(BIG), BIG)
}

describe('the 10 s wait in two parts [SPEC 14 1.43 Open Question 6, F-3; 1.46 RF-1]', () => {
  it('an upload whose body takes over 10 s to be taken, and is answered soon after, succeeds', async () => {
    const server = await slowReader()
    const upload = slowUpload(server.origin)
    const outcome = upload.then(
      (kept) => kept,
      (e: unknown) => e,
    )
    await server.wasSeen
    await vi.advanceTimersByTimeAsync(CONNECT_MS + 1_000)
    server.release()
    expect(await outcome).toMatchObject({ name: 'kept.png', subfolder: 'adman' })
    await server.close()
  })

  it('a server that takes the whole body, then stays silent for 10 s, gives no_answer', async () => {
    const server = await slowReader(true)
    const outcome = failureOf(slowUpload(server.origin))
    await server.wasSeen
    await vi.advanceTimersByTimeAsync(CONNECT_MS + 1_000)
    expect(await stillWaiting(outcome)).toBe(true)
    server.release()
    await server.wasTaken
    await vi.advanceTimersByTimeAsync(CONNECT_MS - 1)
    expect(await stillWaiting(outcome)).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(await outcome).toEqual({
      kind: 'offline',
      reason: 'no_answer',
      detail: 'No answer within the connect wait',
    })
    await server.close()
  })

  it('no connection within 10 s gives no_answer', async () => {
    // A TCP server that never speaks: the TLS handshake never ends, so there is no secureConnect.
    let accepted = (_socket: net.Socket) => {}
    const wasAccepted = new Promise<net.Socket>((done) => (accepted = done))
    const silent = net.createServer((socket) => accepted(socket))
    await new Promise<void>((done) => silent.listen(0, '127.0.0.1', done))
    const { port } = silent.address() as AddressInfo
    const c = createComfyClient({ origin: `https://127.0.0.1:${port}`, ownPorts: () => [9100] })
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const outcome = failureOf(c.systemStats())
    await wasAccepted
    await vi.advanceTimersByTimeAsync(CONNECT_MS - 1)
    expect(await stillWaiting(outcome)).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(await outcome).toEqual({
      kind: 'offline',
      reason: 'no_answer',
      detail: 'No connection within the connect wait',
    })
    ;(await wasAccepted).destroy()
    await new Promise((done) => silent.close(done))
  })

  it('an upload that is still sending at 120 s gives no_answer', async () => {
    const server = await slowReader()
    const outcome = failureOf(slowUpload(server.origin))
    await server.wasSeen
    await vi.advanceTimersByTimeAsync(UPLOAD_MS - 1)
    expect(await stillWaiting(outcome)).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(await outcome).toEqual({
      kind: 'offline',
      reason: 'no_answer',
      detail: 'The call went over its time limit',
    })
    await server.close()
  })
})

import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import { createComfyClient, type ComfyClient } from '@/main/providers/comfyui/client'
import { MAX_COMFY_JSON_BYTES } from '@/main/providers/comfyui/limits'
import { uploadName } from '@/main/providers/comfyui/values'
import { everyCall } from '../../../../helpers/comfy-every-call'
import { startComfyStandIn, type StandIn } from '../../../../helpers/comfy-stand-in'
import { failureOf } from '../../../../helpers/failure-of'

let standIn: StandIn
let client: ComfyClient

beforeEach(async () => {
  standIn = await startComfyStandIn()
  client = createComfyClient({ origin: standIn.origin, ownPorts: () => [9100] })
})
afterEach(() => standIn.close())

const id = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const ref = { filename: 'a.png', subfolder: '', type: 'temp' as const }

describe('a redirect is refused and never followed [SPEC 6.10.1, 6.10.2, 14 CU-2]', () => {
  it.each([301, 302, 303, 307, 308])('HTTP %i is redirect_refused, Location unread', async (s) => {
    const elsewhere = 'http://made-up-elsewhere.invalid/steal'
    standIn.reply('*', { status: s, headers: { location: elsewhere } })
    for (const [name, run] of everyCall(client)) {
      standIn.seen.length = 0
      const error = await failureOf(run())
      expect(error, name).toMatchObject({ kind: 'other', reason: 'redirect_refused' })
      expect(JSON.stringify(error)).not.toContain('elsewhere')
      expect(standIn.seen).toHaveLength(1)
    }
  })
})

describe('answer statuses [SPEC 6.10.2, 6.10.3, 6.10.9, 14 CU-2]', () => {
  it.each([401, 403, 407])('HTTP %i is sign_in_needed', async (status) => {
    standIn.reply('GET /system_stats', { status, json: {} })
    expect(await failureOf(client.systemStats())).toMatchObject({ reason: 'sign_in_needed' })
  })

  it('a 400 from POST /prompt is server_refused', async () => {
    standIn.reply('POST /prompt', { status: 400, json: { error: { message: 'bad' } } })
    expect(await failureOf(client.submit(id, {}))).toMatchObject({
      kind: 'other',
      reason: 'server_refused',
    })
  })

  it.each([
    ['a 404', { status: 404, json: {} }],
    ['a 500', { status: 500, json: {} }],
    ['an answer that is not JSON', { body: '<html>router</html>' }],
    ['JSON without the ComfyUI shape', { json: { system: {}, devices: [] } }],
  ])('%s from system_stats is not_comfyui', async (_name, reply) => {
    standIn.reply('GET /system_stats', reply)
    expect(await failureOf(client.systemStats())).toMatchObject({ reason: 'not_comfyui' })
  })

  it('a wrong shape from any other call is bad_result', async () => {
    standIn.reply(`GET /history/${id}`, { json: [1, 2] })
    expect(await failureOf(client.history(id))).toMatchObject({ reason: 'bad_result' })
    standIn.reply('POST /prompt', { json: { prompt_id: 'not-a-uuid', number: 1 } })
    expect(await failureOf(client.submit(id, {}))).toMatchObject({ reason: 'bad_result' })
  })

  it('an upload answer whose name fails the file name check is bad_result', async () => {
    standIn.reply('POST /upload/image', { json: { name: '../../x.png', subfolder: 'adman' } })
    const bytes = new Uint8Array([5])
    expect(await failureOf(client.uploadImage(uploadName(bytes), bytes))).toMatchObject({
      reason: 'bad_result',
    })
  })

  it('another error status is kind other with the status only', async () => {
    standIn.reply('GET /queue', { status: 500, json: { error: 'x' } })
    expect(await failureOf(client.queueIds())).toEqual({ kind: 'other', detail: 'HTTP 500' })
  })
})

describe('no answer [SPEC 6.10.9, 14 CU-2]', () => {
  it('a server that is not running is offline, no_answer, and the detail has no address', async () => {
    await standIn.close()
    const error = await failureOf(client.systemStats())
    expect(error).toMatchObject({ kind: 'offline', reason: 'no_answer' })
    expect(error.detail).not.toContain('127.0.0.1')
    expect(error.detail).not.toContain(String(standIn.port))
  })

  it('a server that drops the connection is offline, no_answer', async () => {
    standIn.reply('GET /system_stats', { vanish: true })
    expect(await failureOf(client.systemStats())).toMatchObject({
      kind: 'offline',
      reason: 'no_answer',
    })
  })
})

describe('byte limits, with and without content-length [SPEC 6.10.2, 14 CU-2]', () => {
  const tooBig = 'x'.repeat(MAX_COMFY_JSON_BYTES + 1)

  it.each([true, false])(
    'a JSON answer over 8 MiB is refused (content-length %s)',
    async (length) => {
      standIn.reply('GET /system_stats', { body: tooBig, length })
      expect(await failureOf(client.systemStats())).toMatchObject({ reason: 'not_comfyui' })
      standIn.reply(`GET /history/${id}`, { body: tooBig, length })
      expect(await failureOf(client.history(id))).toMatchObject({ reason: 'bad_result' })
    },
  )

  it.each([true, false])(
    'a file over maxBytes is bad_result (content-length %s)',
    async (length) => {
      standIn.reply('GET /view', { body: 'y'.repeat(101), length })
      expect(await failureOf(client.viewFile(ref, 100))).toMatchObject({ reason: 'bad_result' })
    },
  )

  it.each([true, false])(
    'a file of exactly maxBytes is kept (content-length %s)',
    async (length) => {
      standIn.reply('GET /view', { body: 'y'.repeat(100), length })
      expect((await client.viewFile(ref, 100)).byteLength).toBe(100)
    },
  )
})

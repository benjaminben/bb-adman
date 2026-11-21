import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import { createComfyClient, type ComfyClient } from '@/main/providers/comfyui/client'
import { uploadName } from '@/main/providers/comfyui/values'
import { startComfyStandIn, type StandIn } from '../../../../helpers/comfy-stand-in'

let standIn: StandIn
let client: ComfyClient

beforeEach(async () => {
  standIn = await startComfyStandIn()
  client = createComfyClient({ origin: standIn.origin, ownPorts: () => [9100] })
})
afterEach(() => standIn.close())

const id = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const last = () => standIn.seen.at(-1)

describe('one function per call, against the stand-in [SPEC 6.10.2, 14 CU-2]', () => {
  it('systemStats: GET /system_stats with no body', async () => {
    expect(await client.systemStats()).toEqual({ comfyuiVersion: '0.3.40', deviceCount: 1 })
    expect(last()).toMatchObject({ method: 'GET', path: '/system_stats' })
    expect(last()?.body.byteLength).toBe(0)
  })

  it('modelFiles: GET /models/{folder}, the folder encoded', async () => {
    expect(await client.modelFiles('diffusion models')).toEqual(['stand-in.safetensors'])
    expect(last()).toMatchObject({ method: 'GET', path: '/models/diffusion%20models' })
  })

  it('modelFiles: null when the server has no such folder', async () => {
    standIn.reply('GET /models/none', { status: 404, json: {} })
    expect(await client.modelFiles('none')).toBeNull()
  })

  it('nodeInfo: GET /object_info/{classType} for one class; found or not', async () => {
    expect(await client.nodeInfo('KSampler')).toBe(true)
    expect(last()).toMatchObject({ method: 'GET', path: '/object_info/KSampler' })
    standIn.reply('GET /object_info/Gone', { json: {} })
    expect(await client.nodeInfo('Gone')).toBe(false)
    standIn.reply('GET /object_info/Missing', { status: 404, json: {} })
    expect(await client.nodeInfo('Missing')).toBe(false)
  })

  it('uploadImage: POST /upload/image with image, type=input, subfolder=adman, never overwrite', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3])
    const name = uploadName(bytes)
    expect(await client.uploadImage(name, bytes)).toEqual({ name, subfolder: 'adman' })
    const seen = last()
    expect(seen).toMatchObject({ method: 'POST', path: '/upload/image' })
    const text = seen?.body.toString('latin1') ?? ''
    expect(text).toContain(`name="image"; filename="${name}"`)
    expect(text).toMatch(/name="type"\r\n\r\ninput\r\n/)
    expect(text).toMatch(/name="subfolder"\r\n\r\nadman\r\n/)
    expect(text).not.toContain('overwrite')
    expect(seen?.body.includes(Buffer.from(bytes))).toBe(true)
  })

  it('submit: POST /prompt with exactly prompt, prompt_id and client_id', async () => {
    const graph = { 3: { class_type: 'KSampler', inputs: {} } }
    expect(await client.submit(id, graph)).toEqual({ promptId: id, number: 1 })
    const seen = last()
    expect(seen).toMatchObject({ method: 'POST', path: '/prompt' })
    const sent = JSON.parse(seen?.body.toString('utf8') ?? '') as Record<string, unknown>
    expect(Object.keys(sent).sort()).toEqual(['client_id', 'prompt', 'prompt_id'])
    expect(sent).toMatchObject({ prompt: graph, prompt_id: id })
    expect(typeof sent.client_id).toBe('string')
  })

  it('history: GET /history/{promptId}; the entry for that ID, or null', async () => {
    expect(await client.history(id)).toBeNull()
    expect(last()).toMatchObject({ method: 'GET', path: `/history/${id}` })
    standIn.reply(`GET /history/${id}`, { json: { [id]: { outputs: {} } } })
    expect(await client.history(id)).toEqual({ outputs: {} })
  })

  it('jobState: GET /api/jobs/{promptId}; null on 404', async () => {
    expect(await client.jobState(id)).toEqual({ status: 'pending' })
    expect(last()).toMatchObject({ method: 'GET', path: `/api/jobs/${id}` })
    standIn.reply(`GET /api/jobs/${id}`, { status: 404, json: {} })
    expect(await client.jobState(id)).toBeNull()
  })

  it('queueIds: GET /queue, IDs only', async () => {
    expect(await client.queueIds()).toEqual({ running: [], pending: [] })
    expect(last()).toMatchObject({ method: 'GET', path: '/queue' })
  })

  it('removeFromQueue: POST /queue with exactly {"delete":[promptId]}', async () => {
    await client.submit(id, {})
    await client.removeFromQueue(id)
    expect(last()).toMatchObject({ method: 'POST', path: '/queue' })
    expect(last()?.body.toString('utf8')).toBe(JSON.stringify({ delete: [id] }))
  })

  it('interrupt: POST /interrupt with exactly {"prompt_id": promptId}', async () => {
    await client.submit(id, {})
    await client.interrupt(id)
    expect(last()).toMatchObject({ method: 'POST', path: '/interrupt' })
    expect(last()?.body.toString('utf8')).toBe(JSON.stringify({ prompt_id: id }))
  })

  it('viewFile: GET /view with filename, subfolder and type encoded', async () => {
    const bytes = await client.viewFile(
      { filename: 'a b.png', subfolder: 'adman', type: 'temp' },
      1000,
    )
    expect(Buffer.from(bytes).toString()).toBe('stand-in picture bytes')
    expect(last()).toMatchObject({
      method: 'GET',
      path: '/view?filename=a%20b.png&subfolder=adman&type=temp',
    })
  })
})

describe('fixed headers, no cookie kept [SPEC 6.10.2, 14 CU-2]', () => {
  const allowed = ['accept', 'connection', 'content-length', 'content-type', 'host', 'user-agent']

  it('sends only the fixed headers on every call, User-Agent Adman', async () => {
    standIn.reply('GET /system_stats', {
      json: { system: { comfyui_version: '1' }, devices: [] },
      headers: { 'set-cookie': 'session=made-up-cookie' },
    })
    await client.systemStats()
    await client.submit(id, {})
    await client.uploadImage(uploadName(new Uint8Array([1])), new Uint8Array([1]))
    await client.systemStats()
    for (const seen of standIn.seen) {
      expect(Object.keys(seen.headers).every((h) => allowed.includes(h))).toBe(true)
      expect(seen.headers['user-agent']).toBe('Adman')
      expect(seen.headers.origin).toBeUndefined()
      expect(seen.headers.cookie).toBeUndefined()
    }
    expect(standIn.seen[0]?.headers.host).toBe(`127.0.0.1:${standIn.port}`)
  })
})

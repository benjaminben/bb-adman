import { describe, it, expect, afterEach } from 'vitest'
import { checkServer, createServerChecks } from '@/main/providers/comfyui/needs'
import { createComfyClient } from '@/main/providers/comfyui/client'
import { ProviderFailure } from '@/main/providers/types'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import { mossTextToImage } from '@/main/providers/comfyui/workflows/moss'
import { h3TextToVideo } from '@/main/providers/comfyui/workflows/h3'
import { startComfyStandIn, type StandIn } from '../../../../helpers/comfy-stand-in'

let stand: StandIn | undefined
afterEach(async () => {
  await stand?.close()
  stand = undefined
})

const withNeeds = (spec: WorkflowSpec, needs: Partial<WorkflowSpec['needs']>): WorkflowSpec => ({
  ...spec,
  needs: { ...spec.needs, ...needs },
})

const PICTURE = withNeeds(mossTextToImage, {
  minComfyVersion: '0.42.0',
  models: [
    { folder: 'vae', file: 'a.safetensors' },
    { folder: 'loras', file: 'b.safetensors' },
    { folder: 'text_encoders', file: 'c.safetensors' },
  ],
  nodeClasses: ['KSampler', 'NoSuchNode', 'EmptyAnswer'],
})
const VIDEO = withNeeds(h3TextToVideo, {
  minComfyVersion: '0.33.0',
  models: [{ folder: 'vae', file: 'a.safetensors' }],
  nodeClasses: ['KSampler'],
})

async function server(version: unknown = '0.42.1') {
  stand = await startComfyStandIn()
  stand.reply('GET /system_stats', { json: { system: { comfyui_version: version }, devices: [] } })
  stand.reply('GET /models/vae', { json: ['a.safetensors', '<b>evil</b>.safetensors'] })
  stand.reply('GET /models/loras', { json: ['edit/b.safetensors'] })
  stand.reply('GET /models/text_encoders', { status: 404, json: {} })
  stand.reply('GET /object_info/NoSuchNode', { status: 404, json: {} })
  stand.reply('GET /object_info/EmptyAnswer', { json: {} })
  return stand
}

const clientFor = (s: StandIn, ownPorts: number[] = []) =>
  createComfyClient({ origin: s.origin, ownPorts: () => ownPorts })

describe('checkServer: the comparison of SPEC 6.10.3 [FR-263, FR-266]', () => {
  it('lists, per workflow, each missing item with names from the app’s own file', async () => {
    const s = await server()
    const result = await checkServer(clientFor(s), [PICTURE, VIDEO])
    expect(result).toEqual({
      outcome: 'ok',
      version: '0.42.1',
      workflows: [
        {
          id: 'moss-text-to-image',
          missing: [
            { what: 'model', name: 'c.safetensors', folder: 'text_encoders' },
            { what: 'node', name: 'NoSuchNode' },
            { what: 'node', name: 'EmptyAnswer' },
          ],
        },
        { id: 'h3-text-to-video', missing: [] },
      ],
    })
  })

  it('asks once per folder and once per node class, and sends no prompt or picture', async () => {
    const s = await server()
    await checkServer(clientFor(s), [PICTURE, VIDEO])
    const paths = s.seen.map((r) => `${r.method} ${r.path}`)
    expect(paths).toEqual([
      'GET /system_stats',
      'GET /models/vae',
      'GET /models/loras',
      'GET /models/text_encoders',
      'GET /object_info/KSampler',
      'GET /object_info/NoSuchNode',
      'GET /object_info/EmptyAnswer',
    ])
  })

  it('counts a version older than the workflow needs as a missing item', async () => {
    const s = await server('0.42.0')
    const result = await checkServer(clientFor(s), [
      withNeeds(PICTURE, { minComfyVersion: '0.43.0', models: [], nodeClasses: [] }),
    ])
    expect(result.workflows[0]?.missing).toEqual([{ what: 'version', name: '0.43.0' }])
    expect(result.note).toBeUndefined()
  })

  it('compares versions as dotted numbers, not as text', async () => {
    const s = await server('0.100.0')
    const spec = withNeeds(PICTURE, { minComfyVersion: '0.43.0', models: [], nodeClasses: [] })
    expect((await checkServer(clientFor(s), [spec])).workflows[0]?.missing).toEqual([])
  })

  it('makes an unreadable version a note and not a failure [3.3 Compatibility]', async () => {
    const s = await server('nightly')
    const spec = withNeeds(PICTURE, { models: [], nodeClasses: [] })
    const result = await checkServer(clientFor(s), [spec])
    expect(result.outcome).toBe('ok')
    expect(result.workflows[0]?.missing).toEqual([])
    expect(result.note).toMatch(/could not read/i)
  })

  it('makes a version newer than the one a workflow was checked with a note', async () => {
    const s = await server('0.45.0')
    const spec = withNeeds(PICTURE, { checkedWith: '0.44.2', models: [], nodeClasses: [] })
    const result = await checkServer(clientFor(s), [spec])
    expect(result.workflows[0]?.missing).toEqual([])
    expect(result.note).toMatch(/newer/i)
  })

  it.each([
    ['a 404', { status: 404, json: {} }, 'not_comfyui'],
    ['the wrong shape', { json: { hello: 'world' } }, 'not_comfyui'],
    ['a 401', { status: 401, json: {} }, 'sign_in_needed'],
    ['a 407', { status: 407, json: {} }, 'sign_in_needed'],
    [
      'a redirect',
      { status: 302, headers: { location: 'http://127.0.0.1:1/' } },
      'redirect_refused',
    ],
    ['a dropped connection', { vanish: true }, 'no_answer'],
  ] as const)(
    'on %s from /system_stats gives %s and sends exactly one request',
    async (_n, reply, outcome) => {
      stand = await startComfyStandIn()
      stand.reply('GET /system_stats', reply)
      const result = await checkServer(clientFor(stand), [PICTURE, VIDEO])
      expect(result).toEqual({ outcome, workflows: [] })
      expect(stand.seen.map((r) => r.path)).toEqual(['/system_stats'])
    },
  )

  it('gives address_refused for one of the app’s own ports, and sends nothing', async () => {
    stand = await startComfyStandIn()
    const result = await checkServer(clientFor(stand, [stand.port]), [PICTURE])
    expect(result).toEqual({ outcome: 'address_refused', workflows: [] })
    expect(stand.seen).toEqual([])
  })

  it('gives certificate when the handshake fails its certificate check', async () => {
    const client = {
      systemStats: () =>
        Promise.reject(new ProviderFailure({ kind: 'other', reason: 'certificate', detail: 'x' })),
      modelFiles: () => Promise.reject(new Error('not called')),
      nodeInfo: () => Promise.reject(new Error('not called')),
    }
    expect(await checkServer(client, [PICTURE])).toEqual({ outcome: 'certificate', workflows: [] })
  })

  it('ends with the failure’s outcome when the server stops answering after the handshake', async () => {
    const s = await server()
    s.reply('GET /models/loras', { vanish: true })
    expect(await checkServer(clientFor(s), [PICTURE])).toEqual({
      outcome: 'no_answer',
      workflows: [],
    })
  })

  it('ends with not_comfyui when a later answer is not one ComfyUI gives', async () => {
    const s = await server()
    s.reply('GET /models/vae', { status: 500, json: {} })
    expect(await checkServer(clientFor(s), [PICTURE])).toEqual({
      outcome: 'not_comfyui',
      workflows: [],
    })
  })

  it('lets an error that is not a provider failure through', async () => {
    const client = {
      systemStats: () => Promise.reject(new TypeError('a bug')),
      modelFiles: () => Promise.resolve(null),
      nodeInfo: () => Promise.resolve(false),
    }
    await expect(checkServer(client, [PICTURE])).rejects.toThrow(TypeError)
  })
})

describe('createServerChecks: 60 seconds per origin [SPEC 6.10.3, 14 1.43 N-03]', () => {
  it('keeps a result for 60 seconds per origin, then asks again', async () => {
    const s = await server()
    let now = 1_000_000
    const checks = createServerChecks({ now: () => now })
    const client = clientFor(s)
    const first = await checks.run(s.origin, client, [VIDEO])
    const count = s.seen.length
    now += 59_999
    expect(await checks.run(s.origin, client, [VIDEO])).toEqual(first)
    expect(s.seen.length).toBe(count)
    now += 2
    await checks.run(s.origin, client, [VIDEO])
    expect(s.seen.length).toBe(count * 2)
  })

  it('keeps only an ok: a failed check is asked again at once [1.45 N3-2, B-5]', async () => {
    const s = await server()
    const checks = createServerChecks({ now: () => 0 })
    const client = clientFor(s)
    s.reply('GET /system_stats', { vanish: true })
    expect((await checks.run(s.origin, client, [VIDEO])).outcome).toBe('no_answer')
    s.reply('GET /system_stats', { json: { system: { comfyui_version: '0.42.1' }, devices: [] } })
    expect((await checks.run(s.origin, client, [VIDEO])).outcome).toBe('ok')
    const count = s.seen.length
    expect((await checks.run(s.origin, client, [VIDEO])).outcome).toBe('ok')
    expect(s.seen.length).toBe(count)
  })

  it('asks again when told to, and keeps origins apart', async () => {
    const s = await server()
    const checks = createServerChecks({ now: () => 0 })
    const client = clientFor(s)
    await checks.run(s.origin, client, [VIDEO])
    const count = s.seen.length
    await checks.run(s.origin, client, [VIDEO], { fresh: true })
    expect(s.seen.length).toBe(count * 2)
    await checks.run('http://127.0.0.1:1', client, [VIDEO])
    expect(s.seen.length).toBe(count * 3)
  })
})

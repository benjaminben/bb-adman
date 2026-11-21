import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import dns from 'node:dns'
import {
  createComfyClient,
  type ComfyClient,
} from '../../../../../src/main/providers/comfyui/client'
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
  vi.restoreAllMocks()
  await standIn.close()
})

const id = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'

// dns.lookup answering every name with one address, as the checked lookup asks (all: true).
function resolveEveryNameTo(address: string): void {
  vi.spyOn(dns, 'lookup').mockImplementation(((_host: string, _o: unknown, cb: unknown) => {
    ;(cb as (e: null, list: dns.LookupAddress[]) => void)(null, [{ address, family: 4 }])
  }) as unknown as typeof dns.lookup)
}

describe('the address is checked at every connection [SPEC 6.10.1, 6.10.2, 14 CU-2]', () => {
  it('refuses a loopback origin on an own port, as the ports are at that moment', async () => {
    let ports = [9100]
    const own = createComfyClient({ origin: standIn.origin, ownPorts: () => ports })
    await own.systemStats()
    ports = [standIn.port]
    expect(await failureOf(own.systemStats())).toMatchObject({
      kind: 'other',
      reason: 'address_refused',
    })
    expect(standIn.seen).toHaveLength(1)
  })

  it('refuses a name that resolves to a refused address, with nothing sent', async () => {
    resolveEveryNameTo('169.254.169.254')
    const named = createComfyClient({
      origin: `http://comfy-stand-in.test:${standIn.port}`,
      ownPorts: () => [9100],
    })
    expect(await failureOf(named.systemStats())).toMatchObject({ reason: 'address_refused' })
    expect(standIn.seen).toHaveLength(0)
  })

  it('reaches the address it checked when a name resolves to an allowed one', async () => {
    resolveEveryNameTo('127.0.0.1')
    const named = createComfyClient({
      origin: `http://comfy-stand-in.test:${standIn.port}`,
      ownPorts: () => [9100],
    })
    expect(await named.systemStats()).toMatchObject({ comfyuiVersion: '0.3.40' })
    expect(standIn.seen[0]?.headers.host).toBe(`comfy-stand-in.test:${standIn.port}`)
  })

  it('refuses a loopback name on an own port after the lookup', async () => {
    resolveEveryNameTo('127.0.0.1')
    const named = createComfyClient({
      origin: `http://comfy-stand-in.test:${standIn.port}`,
      ownPorts: () => [standIn.port],
    })
    expect(await failureOf(named.systemStats())).toMatchObject({ reason: 'address_refused' })
    expect(standIn.seen).toHaveLength(0)
  })
})

describe('own-ID rule for removeFromQueue and interrupt [SPEC 6.10.2, 6.11.2, 14 CU-2]', () => {
  const other = '11111111-2222-4333-8444-555555555555'

  it.each(['removeFromQueue', 'interrupt'] as const)(
    '%s refuses an ID the client did not submit or adopt, with nothing sent',
    async (name) => {
      await client.submit(id, {})
      const before = standIn.seen.length
      await expect(client[name](other)).rejects.toThrow()
      expect(standIn.seen).toHaveLength(before)
    },
  )

  it.each(['removeFromQueue', 'interrupt'] as const)(
    '%s accepts an ID handed from a job row',
    async (name) => {
      client.adopt(other)
      await client[name](other)
      expect(standIn.seen.at(-1)?.body.toString('utf8')).toContain(other)
    },
  )

  it('uses the ID in the submit answer from then on', async () => {
    standIn.reply('POST /prompt', { json: { prompt_id: other, number: 2 } })
    expect(await client.submit(id, {})).toEqual({ promptId: other, number: 2 })
    await client.interrupt(other)
    expect(standIn.seen.at(-1)?.path).toBe('/interrupt')
  })

  it('adopts only an ID with the UUID pattern', () => {
    expect(() => client.adopt('../queue')).toThrow()
  })
})

describe('values are checked before anything is sent [SPEC 6.10.2, 14 CU-2]', () => {
  it.each([
    ['submit', () => client.submit('not-a-uuid', {})],
    ['history', () => client.history('../queue')],
    ['jobState', () => client.jobState('x')],
    ['uploadImage', () => client.uploadImage('other.png', new Uint8Array([1]))],
    [
      'viewFile a path',
      () => client.viewFile({ filename: '../a', subfolder: '', type: 'temp' }, 9),
    ],
    [
      'viewFile a subfolder',
      () => client.viewFile({ filename: 'a', subfolder: '/x', type: 'temp' }, 9),
    ],
    [
      'viewFile a type',
      () => client.viewFile({ filename: 'a', subfolder: '', type: 'input' as 'temp' }, 9),
    ],
  ])('%s with a value that fails its check sends nothing', async (_name, run) => {
    await expect(run()).rejects.toThrow()
    expect(standIn.seen).toHaveLength(0)
  })

  it('uploadImage accepts the name the app gives the bytes', async () => {
    const bytes = new Uint8Array([9, 9])
    await client.uploadImage(uploadName(bytes), bytes)
    expect(standIn.seen).toHaveLength(1)
  })
})

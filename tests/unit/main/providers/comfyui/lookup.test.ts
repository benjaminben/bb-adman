import { describe, it, expect } from 'vitest'
import type { LookupAddress } from 'node:dns'
import {
  AddressRefused,
  checkedLookup,
  type Resolve,
} from '../../../../../src/main/providers/comfyui/lookup'

function resolver(list: LookupAddress[] | Error): Resolve {
  return (_host, cb) => {
    if (list instanceof Error) cb(list, [])
    else cb(null, list)
  }
}

type Outcome = { err: Error | null; address?: unknown; family?: number }

function run(lookup: ReturnType<typeof checkedLookup>, all: boolean): Promise<Outcome> {
  return new Promise((done) => {
    lookup('comfy.lan', { all }, (err, address, family) => done({ err, address, family }))
  })
}

describe('the resolved-address check [SPEC 6.10.2, 14 CU-2]', () => {
  const lan = [{ address: '192.168.1.20', family: 4 }]

  it('hands the socket the address it checked', async () => {
    const lookup = checkedLookup(8188, () => [9100], resolver(lan))
    expect(await run(lookup, false)).toEqual({ err: null, address: '192.168.1.20', family: 4 })
  })

  it('hands back the whole checked list when the socket asks for all addresses', async () => {
    const two = [...lan, { address: 'fd12::5', family: 6 }]
    const lookup = checkedLookup(8188, () => [9100], resolver(two))
    expect(await run(lookup, true)).toEqual({ err: null, address: two, family: undefined })
  })

  it.each(['169.254.169.254', 'fe80::1', '0.0.0.0', '::ffff:169.254.169.254', '224.0.0.1'])(
    'refuses when the name resolves to %s',
    async (address) => {
      const list = [...lan, { address, family: address.includes(':') ? 6 : 4 }]
      const lookup = checkedLookup(8188, () => [9100], resolver(list))
      const { err } = await run(lookup, false)
      expect(err).toBeInstanceOf(AddressRefused)
    },
  )

  it('refuses a loopback address on one of the app own ports, as the ports are at that moment', async () => {
    let ports = [9100]
    const lookup = checkedLookup(9200, () => ports, resolver([{ address: '127.0.0.1', family: 4 }]))
    expect((await run(lookup, false)).err).toBeNull()
    ports = [9200]
    expect((await run(lookup, false)).err).toBeInstanceOf(AddressRefused)
  })

  it('refuses a name that resolves to nothing', async () => {
    const lookup = checkedLookup(8188, () => [9100], resolver([]))
    expect((await run(lookup, false)).err).toBeInstanceOf(AddressRefused)
  })

  it('passes a resolver error on unchanged', async () => {
    const failure = Object.assign(new Error('not found'), { code: 'ENOTFOUND' })
    const lookup = checkedLookup(8188, () => [9100], resolver(failure))
    expect((await run(lookup, false)).err).toBe(failure)
  })
})

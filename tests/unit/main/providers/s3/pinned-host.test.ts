import { describe, it, expect } from 'vitest'
import {
  isNetworkError,
  pinnedHandler,
  s3Hosts,
} from '../../../../../src/main/providers/s3/pinned-host'
import { ProviderFailure } from '../../../../../src/main/providers/types'

type Req = { protocol: string; hostname: string; port?: number }

function innerHandler(fail?: Error) {
  const calls: Req[] = []
  return {
    calls,
    handler: {
      async handle(request: Req) {
        calls.push(request)
        if (fail) throw fail
        return { response: { statusCode: 200, headers: {}, body: undefined } }
      },
    },
  }
}

const HOSTS = s3Hosts('made-up-bucket', 'eu-west-1')
const send = (handler: ReturnType<typeof pinnedHandler>, request: Req) =>
  handler.handle(request as never)

describe('S3 pinned host [SPEC 6 1.12]', () => {
  it('names the bucket host and the regional host', () => {
    expect(HOSTS).toEqual([
      'made-up-bucket.s3.eu-west-1.amazonaws.com',
      's3.eu-west-1.amazonaws.com',
    ])
  })

  it.each([
    ['another host', { protocol: 'https:', hostname: 'elsewhere.example' }],
    ['plain http', { protocol: 'http:', hostname: 's3.eu-west-1.amazonaws.com' }],
    ['another port', { protocol: 'https:', hostname: 's3.eu-west-1.amazonaws.com', port: 8443 }],
    ['a look-alike host', { protocol: 'https:', hostname: 's3.eu-west-1.amazonaws.com.example' }],
  ])('refuses %s before anything is sent', async (_case, request) => {
    const { calls, handler } = innerHandler()
    const call = send(pinnedHandler(handler, HOSTS), request)
    await expect(call).rejects.toBeInstanceOf(ProviderFailure)
    await expect(call).rejects.toMatchObject({ error: { kind: 'other' } })
    expect(calls).toHaveLength(0)
  })

  it('passes a request to a pinned host on to the real handler', async () => {
    const { calls, handler } = innerHandler()
    const request = { protocol: 'https:', hostname: 'made-up-bucket.s3.eu-west-1.amazonaws.com' }
    await send(pinnedHandler(handler, HOSTS), { ...request, port: 443 })
    expect(calls).toHaveLength(1)
  })

  it('marks an error thrown by the network call itself, and only that', async () => {
    const network = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
    const { handler } = innerHandler(network)
    const request = { protocol: 'https:', hostname: 's3.eu-west-1.amazonaws.com' }
    const thrown = await send(pinnedHandler(handler, HOSTS), request).catch((e: unknown) => e)
    expect(isNetworkError(thrown)).toBe(true)
    expect(isNetworkError(network)).toBe(false)
  })
})

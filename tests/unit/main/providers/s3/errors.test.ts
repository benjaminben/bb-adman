import { Readable } from 'node:stream'
import { describe, it, expect } from 'vitest'
import { s3Storage } from '../../../../../src/main/providers/s3/s3-storage'
import { failureFromS3Error } from '../../../../../src/main/providers/s3/failure'
import { ProviderFailure } from '../../../../../src/main/providers/types'
import { TEST_KEY_ID, TEST_SECRET, handlerAnswering, testContext, xml } from './recorded'

async function failureOf(call: Promise<unknown>): Promise<ProviderFailure> {
  try {
    await call
  } catch (error) {
    if (error instanceof ProviderFailure) return error
    throw error
  }
  throw new Error('expected the call to fail')
}

describe('S3 failures become one ProviderFailure with an error kind [SPEC 6]', () => {
  it.each([
    ['error-invalid-access-key-id.xml', 403, 'bad_key'],
    ['error-signature-does-not-match.xml', 403, 'bad_key'],
    ['error-access-denied.xml', 403, 'bad_key'],
    ['error-slow-down.xml', 503, 'quota'],
    ['error-request-timeout.xml', 400, 'timeout'],
    ['error-no-such-bucket.xml', 404, 'other'],
    ['error-no-such-key.xml', 404, 'other'],
    ['error-internal.xml', 500, 'other'],
  ] as const)('%s (HTTP %i) is %s', async (name, status, kind) => {
    const { requestHandler } = handlerAnswering(xml(name, status))
    const failure = await failureOf(s3Storage(testContext(), { requestHandler }).read('a.txt'))
    expect(failure.error.kind).toBe(kind)
    expect(failure.error.detail).toContain(`HTTP ${status}`)
  })

  it('keeps the S3 error code and message in the detail, without the access key ID', async () => {
    const { requestHandler } = handlerAnswering(xml('error-invalid-access-key-id.xml', 403))
    const failure = await failureOf(s3Storage(testContext(), { requestHandler }).list(''))
    expect(failure.error.detail).toContain('InvalidAccessKeyId')
    expect(failure.error.detail).not.toContain(TEST_KEY_ID)
  })

  it.each(['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'EAI_AGAIN'])(
    'a network failure with code %s is offline',
    async (code) => {
      const network = Object.assign(new Error(`connect ${code}`), { code })
      const { requestHandler } = handlerAnswering(network)
      const failure = await failureOf(s3Storage(testContext(), { requestHandler }).exists('a'))
      expect(failure.error.kind).toBe('offline')
    },
  )

  it('a request that timed out is timeout', async () => {
    const timedOut = Object.assign(new Error('Request timed out'), { name: 'TimeoutError' })
    const { requestHandler } = handlerAnswering(timedOut)
    const failure = await failureOf(s3Storage(testContext(), { requestHandler }).exists('a'))
    expect(failure.error.kind).toBe('timeout')
  })

  it('removes both keys from any detail text', () => {
    const error = new Error(`bad ${TEST_KEY_ID} and ${TEST_SECRET}`)
    const failure = failureFromS3Error(error, [TEST_KEY_ID, TEST_SECRET])
    expect(failure.error).toEqual({
      kind: 'other',
      detail: 'Error: bad [key removed] and [key removed]',
    })
  })

  it('passes a ProviderFailure through unchanged', () => {
    const original = new ProviderFailure({ kind: 'quota', detail: 'x' })
    expect(failureFromS3Error(original, [])).toBe(original)
  })
})

describe('every S3 ProviderFailure goes through redactSecret [SPEC 6 1.12, 6.5 1.14 H4, F-06]', () => {
  it('removes both keys from a ProviderFailure it passes on, such as a refused request', () => {
    const encoded = Buffer.from(TEST_SECRET).toString('base64')
    const refused = new ProviderFailure({
      kind: 'other',
      detail: `Request refused: https://${TEST_KEY_ID}.example:${encoded} is not the S3 host`,
    })
    const failure = failureFromS3Error(refused, [TEST_KEY_ID, TEST_SECRET])
    expect(failure.error).toEqual({
      kind: 'other',
      detail: 'Request refused: https://[key removed].example:[key removed] is not the S3 host',
    })
  })
})

describe('S3: a break while the answer is read [SPEC 6.2 1.14, 14 H2, G8]', () => {
  it('maps a body that fails part way to offline', async () => {
    const requestHandler = {
      async handle() {
        const body = new Readable({
          read() {
            this.push(Buffer.from('part of the file'))
            this.destroy(Object.assign(new Error('aborted'), { code: 'ECONNRESET' }))
          },
        })
        const headers = { 'content-type': 'text/plain', 'content-length': '100' }
        return { response: { statusCode: 200, headers, body } }
      },
    }
    const failure = await failureOf(s3Storage(testContext(), { requestHandler }).read('a.txt'))
    expect(failure.error.kind).toBe('offline')
  })
})

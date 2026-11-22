// Review leftovers, "Publish": S3 read stops at its byte limit and fails as `other`.
import { describe, it, expect } from 'vitest'
import { s3Storage } from '@/main/providers/s3/s3-storage'
import { handlerAnswering, testContext } from './recorded'

const bytes = new TextEncoder().encode('0123456789')
const sized = { 'content-length': String(bytes.length) }

const readAt = (limit: number, headers: Record<string, string>) => {
  const { requestHandler } = handlerAnswering({ status: 200, headers, body: bytes })
  return s3Storage(testContext(), { requestHandler }).read('x.bin', limit)
}

describe('S3 storage: read under a byte limit', () => {
  it('reads a file at the limit', async () => {
    expect(await readAt(10, sized)).toEqual(bytes)
  })

  it.each([
    ['a stated size', sized],
    ['no stated size', {}],
  ])('refuses a file over the limit, with %s', async (_, headers) => {
    await expect(readAt(9, headers)).rejects.toMatchObject({
      name: 'ProviderFailure',
      error: { kind: 'other' },
    })
  })
})

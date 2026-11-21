import { describe, it, expect } from 'vitest'
import { s3Storage } from '../../../../../src/main/providers/s3/s3-storage'
import { ProviderFailure } from '../../../../../src/main/providers/types'
import { handlerAnswering, testContext, xml } from './recorded'

describe('S3 list returns files only [SPEC 6.5 1.14 F-07, H12]', () => {
  it('leaves out a folder-marker key that ends in /', async () => {
    const { requestHandler } = handlerAnswering(xml('list-objects-v2-folder-marker.xml'))
    const listed = await s3Storage(testContext(), { requestHandler }).list('folder')
    expect(listed).toEqual(['folder/a.txt'])
  })
})

describe('S3 exists answers false for anything not there [SPEC 6.5 1.14, H13]', () => {
  it('is false when the bucket itself is missing, and the next write fails with other', async () => {
    const { requestHandler } = handlerAnswering(
      { status: 404 },
      xml('error-no-such-bucket.xml', 404),
    )
    const storage = s3Storage(testContext(), { requestHandler })
    expect(await storage.exists('a.txt')).toBe(false)
    const failure = await storage
      .write('a.txt', new Uint8Array([1]), 'text/plain')
      .catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ProviderFailure)
    expect((failure as ProviderFailure).error.kind).toBe('other')
  })
})

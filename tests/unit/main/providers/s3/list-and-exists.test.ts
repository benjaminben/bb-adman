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

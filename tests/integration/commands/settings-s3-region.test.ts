import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import type { AppState } from '../../../src/shared/schemas/queries/app'

let f: Fixture
afterEach(() => f.cleanup())

const state = async () => data<AppState>(await f.core.query('app.getState', {}, { actor: 'user' }))
const s3 = (region: string) => ({ bucket: 'made-up-bucket', region, prefix: '' })

const CHINA = 'Amazon S3 regions in China are not supported in this build.'
const NOT_A_REGION =
  'That is not an Amazon S3 region. Storage services that copy S3 are not supported in this build.'

describe('settings.update refuses S3 storage the app does not support [SPEC 14 1.39 S3, Z4; FR-308]', () => {
  it.each([
    ['cn-north-1', CHINA],
    ['cn-northwest-1', CHINA],
    ['https://example.com', NOT_A_REGION],
    ['minio.local:9000', NOT_A_REGION],
  ])('refuses %s with storage_not_supported and saves nothing', async (region, message) => {
    f = makeFixture()
    const result = await f.user('settings.update', {
      storage: { s3: s3(region) },
      generation: { optionsPerRun: 2 },
    })
    expect(result).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message, details: { reason: 'storage_not_supported' } },
    })
    const settings = (await state()).settings
    expect(settings.storage.s3).toBeNull()
    expect(settings.generation.optionsPerRun).toBe(4)
  })

  it.each(['eu-west-1', 'us-east-1'])('saves the region %s', async (region) => {
    f = makeFixture()
    const result = await f.user('settings.update', { storage: { s3: s3(region) } })
    expect(result.ok).toBe(true)
    expect((await state()).settings.storage.s3).toEqual(s3(region))
  })
})

describe('settings.update saves an empty S3 region [SPEC 14 1.40 AA6]', () => {
  it('saves a bucket with the region left empty', async () => {
    f = makeFixture()
    const result = await f.user('settings.update', { storage: { s3: s3('') } })
    expect(result.ok).toBe(true)
    expect((await state()).settings.storage.s3).toEqual(s3(''))
  })
})

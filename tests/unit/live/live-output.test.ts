import { describe, it, expect } from 'vitest'
import { ProviderFailure } from '../../../src/main/providers/types'
import { liveValues, missingNames, safeFailure, safeText } from '../../live/live-output'

// Made up; none looks like a real bucket, region or key.
const env = {
  GEMINI_API_KEY: 'made-up-gemini-value',
  ADMAN_LIVE_S3_BUCKET: 'made-up-bucket',
  ADMAN_LIVE_S3_REGION: 'zz-made-up-9',
  ADMAN_LIVE_S3_PREFIX: 'made-up-prefix',
  AWS_ACCESS_KEY_ID: 'made-up-id',
  AWS_SECRET_ACCESS_KEY: 'made-up-secret',
  ADMAN_LIVE_KEEP: '',
  NOT_A_LIVE_NAME: 'shown',
}

describe('live test output holds no live value [SPEC 13, 14 H11, F-04]', () => {
  it('takes the set values of the live variables only', () => {
    expect(liveValues(env).sort()).toEqual(
      [
        'made-up-gemini-value',
        'made-up-bucket',
        'zz-made-up-9',
        'made-up-prefix',
        'made-up-id',
        'made-up-secret',
      ].sort(),
    )
  })

  it('removes the bucket name, the region, the prefix and both keys from text', () => {
    const text =
      'getaddrinfo ENOTFOUND made-up-bucket.s3.zz-made-up-9.amazonaws.com ' +
      'made-up-prefix/adman-hand-test made-up-id made-up-secret made-up-gemini-value shown'
    const safe = safeText(text, liveValues(env))
    for (const value of liveValues(env)) expect(safe).not.toContain(value)
    expect(safe).toContain('ENOTFOUND')
    expect(safe).toContain('shown')
  })

  it('removes a longer value before a shorter one held inside it', () => {
    const safe = safeText('host made-up-bucket-x', ['made-up', 'made-up-bucket-x'])
    expect(safe).toBe('host [key removed]')
  })

  it('names only the variables that are missing', () => {
    expect(
      missingNames(
        ['ADMAN_LIVE_S3_BUCKET', 'ADMAN_LIVE_KEEP', 'FAL_KEY', 'AWS_ACCESS_KEY_ID'],
        env,
      ),
    ).toEqual(['ADMAN_LIVE_KEEP', 'FAL_KEY'])
  })

  it('turns a failure into safe lines and an error with no cause and no live value', () => {
    const failure = new ProviderFailure({
      kind: 'offline',
      detail: 'ENOTFOUND made-up-bucket.s3.zz-made-up-9',
    })
    const { lines, error } = safeFailure('S3', failure, liveValues(env))
    expect(lines).toEqual([
      'S3 error kind: offline',
      'S3 error detail: ENOTFOUND [key removed].s3.[key removed]',
    ])
    expect(error.message).toBe('S3 error offline: ENOTFOUND [key removed].s3.[key removed]')
    expect(error.cause).toBeUndefined()
    expect(Object.keys(error)).toEqual([])
  })

  it('gives a failure that is not a ProviderFailure its message, made safe', () => {
    const { lines, error } = safeFailure('S3', new Error('bad made-up-prefix'), liveValues(env))
    expect(lines).toEqual(['S3 error: bad [key removed]'])
    expect(error.message).toBe('S3 error: bad [key removed]')
  })
})

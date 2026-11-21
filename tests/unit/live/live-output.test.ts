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
  it('takes the set values of the redacted live variables only, never the region [1.15 H16]', () => {
    expect(liveValues(env).sort()).toEqual(
      ['made-up-gemini-value', 'made-up-id', 'made-up-secret'].sort(),
    )
  })

  it('removes the bucket name, the prefix and both keys from text, and keeps the region [1.15 H16]', () => {
    const text =
      'getaddrinfo ENOTFOUND made-up-bucket.s3.zz-made-up-9.amazonaws.com ' +
      'made-up-prefix/adman-hand-test made-up-id made-up-secret made-up-gemini-value shown'
    const safe = safeText(text, liveValues(env))
    for (const value of liveValues(env)) expect(safe).not.toContain(value)
    expect(safe).toContain('ENOTFOUND')
    expect(safe).toContain('shown')
    expect(safe).toContain('zz-made-up-9')
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
      detail: 'ENOTFOUND made-up-bucket.s3.zz-made-up-9 made-up-secret',
    })
    const { lines, error } = safeFailure('S3', failure, liveValues(env))
    expect(lines).toEqual([
      'S3 error kind: offline',
      'S3 error detail: ENOTFOUND made-up-bucket.s3.zz-made-up-9 [key removed]',
    ])
    expect(error.message).toBe(
      'S3 error offline: ENOTFOUND made-up-bucket.s3.zz-made-up-9 [key removed]',
    )
    expect(error.cause).toBeUndefined()
    expect(Object.keys(error)).toEqual([])
  })

  it('gives a failure that is not a ProviderFailure its message, made safe', () => {
    const { lines, error } = safeFailure(
      'S3',
      new Error('bad made-up-prefix made-up-id'),
      liveValues(env),
    )
    expect(lines).toEqual(['S3 error: bad made-up-prefix [key removed]'])
    expect(error.message).toBe('S3 error: bad made-up-prefix [key removed]')
  })
})

describe('live output removes only the LIVE_REDACTED_NAMES values [SPEC 6.5 1.15, 14 H16]', () => {
  // Made up; none looks like a real key or bucket.
  const keepRun = {
    FAL_KEY: 'made-up-fal-value',
    ADMAN_LIVE_S3_BUCKET: 'made-up-bucket',
    ADMAN_LIVE_S3_REGION: 'zz-made-up-9',
    ADMAN_LIVE_S3_PREFIX: 'p',
    ADMAN_LIVE_KEEP: '1',
  }

  it('removes a key, and keeps a bucket name and a prefix [1.18 K5]', () => {
    const values = liveValues({ ...keepRun, ADMAN_LIVE_S3_PREFIX: 'made-up-prefix' })
    const safe = safeText('key made-up-fal-value in made-up-bucket/made-up-prefix', values)
    expect(safe).toBe('key [key removed] in made-up-bucket/made-up-prefix')
  })

  it('keeps 1024 x 1024 and a byte count with ADMAN_LIVE_KEEP=1 and a one-letter prefix', () => {
    const text = 'picture 1024 x 1024, 31415 bytes, kept in zz-made-up-9'
    expect(safeText(text, liveValues(keepRun))).toBe(text)
  })
})

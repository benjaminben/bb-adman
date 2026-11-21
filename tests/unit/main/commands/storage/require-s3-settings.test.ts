// requireS3Settings (spec/storage-and-publish.md "Hand-test storage command", "Test connection
// (S3)"): its one owner, used by dev.storage and storage.checkS3.
import { describe, it, expect } from 'vitest'
import { requireS3Settings } from '@/main/commands/storage/require-s3-settings'
import { AppError } from '@/shared/schemas/result'
import type { Settings } from '@/shared/schemas/settings'

type S3 = Settings['storage']['s3']

function depsWith(s3: S3) {
  return { settings: { get: () => ({ storage: { s3, dropbox: null } }) as unknown as Settings } }
}

function refusal(s3: S3): AppError {
  try {
    requireS3Settings(depsWith(s3))
  } catch (error) {
    if (error instanceof AppError) return error
    throw error
  }
  throw new Error('expected a refusal')
}

describe('requireS3Settings [spec/storage-and-publish.md]', () => {
  it.each([
    ['no S3 settings', null],
    ['an empty bucket', { bucket: '', region: 'eu-west-1', prefix: '' }],
    ['an empty region', { bucket: 'made-up-bucket', region: '', prefix: '' }],
  ] as const)('refuses %s as storage_not_set_up', (_name, s3) => {
    const error = refusal(s3)
    expect([error.code, error.message, error.details]).toEqual([
      'RULE_VIOLATION',
      'Amazon S3 is not set up yet. Enter a bucket and a region, then try again.',
      { reason: 'storage_not_set_up', provider: 's3' },
    ])
  })

  it('passes a saved bucket and region, with or without a folder', () => {
    const s3 = { bucket: 'made-up-bucket', region: 'eu-west-1', prefix: '' }
    expect(() => requireS3Settings(depsWith(s3))).not.toThrow()
  })
})

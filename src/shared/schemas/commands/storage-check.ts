// storage.checkS3 (spec/storage-and-publish.md "Test connection (S3)"): its input, its reply,
// its refusal reasons and their fixed sentences. No sentence holds a key, an address or a path.
import { z } from 'zod'

// storage.checkS3 takes no input.
export const storageCheckS3Input = z.object({}).strict()
export type StorageCheckS3Reply = { ok: true }

// The four calls, in order. A missing permission is named by its step.
export const S3_CHECK_STEPS = ['list', 'write', 'read', 'delete'] as const
export type S3CheckStep = (typeof S3_CHECK_STEPS)[number]

export const S3_CHECK_REASONS = [
  's3_wrong_keys',
  's3_bucket_not_found',
  's3_wrong_region',
  's3_permission_missing',
  's3_cannot_reach',
  's3_check_failed',
] as const
export type S3CheckReason = (typeof S3_CHECK_REASONS)[number]

export const S3_CONNECTED_MESSAGE =
  'Connected. Adman can list, write, read and delete files in this folder.'

export const S3_NOT_SET_UP_MESSAGE =
  'Amazon S3 is not set up yet. Enter a bucket and a region, then try again.'

export const S3_LEFT_FILE_MESSAGE =
  'A small test file was left in the folder adman-connection-check. You may delete it.'

const FIXED: Record<Exclude<S3CheckReason, 's3_permission_missing'>, string> = {
  s3_wrong_keys:
    'Amazon S3 did not accept these keys. Check the access key ID and the secret access key.',
  s3_bucket_not_found: 'Amazon S3 has no bucket with that name. Check the bucket name.',
  s3_wrong_region: 'That bucket is in a different region. Check the region.',
  s3_cannot_reach:
    'Adman could not reach Amazon S3. Check the internet connection and the region, then try again.',
  s3_check_failed:
    "Amazon S3 refused the test. Try again, or check the bucket's settings in Amazon Web Services.",
}

const PERMISSION: Record<S3CheckStep, { doing: string; name: string }> = {
  list: { doing: 'list files in', name: 's3:ListBucket' },
  write: { doing: 'write files to', name: 's3:PutObject' },
  read: { doing: 'read files from', name: 's3:GetObject' },
  delete: { doing: 'delete files from', name: 's3:DeleteObject' },
}

export type S3CheckRefusal = { reason: S3CheckReason; permission?: S3CheckStep; leftFile: boolean }

// The one sentence for a refusal, with the left-file line when the test file stayed behind.
export function s3CheckSentence(refusal: S3CheckRefusal): string {
  const { reason, permission, leftFile } = refusal
  let sentence: string
  if (reason === 's3_permission_missing') {
    const { doing, name } = PERMISSION[permission ?? 'list']
    sentence = `These keys may not ${doing} the bucket. Give them the ${name} permission.`
  } else {
    sentence = FIXED[reason]
  }
  return leftFile ? `${sentence} ${S3_LEFT_FILE_MESSAGE}` : sentence
}

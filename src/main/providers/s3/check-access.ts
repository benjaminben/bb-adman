// checkS3Access (spec/storage-and-publish.md "Test connection (S3)"): proves the saved bucket,
// region and keys can list, write, read and delete. It uses buildS3Client, so the same client,
// host pin, socket limits and single attempt as the adapter, and no new outbound path. It does
// not go through s3Storage, which folds a wrong key and a missing permission into bad_key.
// Security class: every key it names is under the folder's adman-connection-check/, and the
// delete names only the key this run wrote. The detail is for the local log only, with both
// keys removed; the outcome holds no address and no provider message outside it.
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import { ulid } from 'ulid'
import { storageFilePath, storageListPrefix } from '@/main/providers/storage-paths'
import type { AdapterContext } from '@/main/providers/types'
import type {
  S3CheckReason,
  S3CheckRefusal,
  S3CheckStep,
} from '@/shared/schemas/commands/storage-check'
import { buildS3Client, type S3Setup } from './client'
import { failureFromS3Error, s3Failure } from './failure'
import { isNetworkError, type PinnableHandler } from './pinned-host'

export const CHECK_FOLDER = 'adman-connection-check'
const CHECK_TEXT = new TextEncoder().encode('Adman connection check. Safe to delete.')

export type S3CheckOutcome = { ok: true } | ({ ok: false; detail: string } & S3CheckRefusal)
type StepFailure = { step: S3CheckStep; error: unknown }

const WRONG_KEYS = new Set([
  'InvalidAccessKeyId',
  'SignatureDoesNotMatch',
  'ExpiredToken',
  'InvalidToken',
])
// IllegalLocationConstraintException: a bucket in an opt-in region reached through another
// region's host. TemporaryRedirect: a new bucket not yet known to every host.
const WRONG_REGION = new Set([
  'PermanentRedirect',
  'AuthorizationHeaderMalformed',
  'IllegalLocationConstraintException',
  'TemporaryRedirect',
])

// The table in "Test connection (S3)": the S3 error name first, then the status.
function classify(name: string, status: number | undefined, step: S3CheckStep) {
  if (WRONG_KEYS.has(name)) return { reason: 's3_wrong_keys' as const }
  if (name === 'NoSuchBucket') return { reason: 's3_bucket_not_found' as const }
  if (WRONG_REGION.has(name) || status === 301) return { reason: 's3_wrong_region' as const }
  if (name === 'AccessDenied' || status === 403) {
    return { reason: 's3_permission_missing' as const, permission: step }
  }
  if (name === 'RequestTimeout') return { reason: 's3_cannot_reach' as const }
  return { reason: 's3_check_failed' as const }
}

function reasonOf({ step, error }: StepFailure): {
  reason: S3CheckReason
  permission?: S3CheckStep
} {
  if (error instanceof S3ServiceException) {
    return classify(error.name, error.$metadata.httpStatusCode, step)
  }
  if (isNetworkError(error)) return { reason: 's3_cannot_reach' }
  if (error instanceof DeleteError) return classify(error.code, undefined, step)
  return { reason: 's3_check_failed' }
}

// A key in DeleteObjects' Errors: a failure like a thrown one.
class DeleteError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(`DeleteObjects failed, ${code}: ${message}`)
  }
}

function detailOf(failure: StepFailure, keys: string[]): string {
  const { error, step } = failure
  const text =
    error instanceof DeleteError
      ? s3Failure('other', error.message, keys).error.detail
      : failureFromS3Error(error, keys).error.detail
  return `${step}: ${text}`
}

// The four calls on a built client. Exported so a test can reach the client under the pin.
export async function runS3Check(setup: S3Setup): Promise<S3CheckOutcome> {
  const { client, bucket: Bucket, root, keys } = setup
  const keyFor = (path: string) => (root === '' ? path : `${root}/${path}`)
  const Key = keyFor(storageFilePath(`${CHECK_FOLDER}/${ulid()}.txt`))
  const failures: StepFailure[] = []
  const attempt = async (step: S3CheckStep, call: () => Promise<void>) => {
    try {
      await call()
      return true
    } catch (error) {
      failures.push({ step, error })
      return false
    }
  }

  const listed = await attempt('list', async () => {
    const Prefix = keyFor(storageListPrefix(CHECK_FOLDER))
    await client.send(new ListObjectsV2Command({ Bucket, Prefix, MaxKeys: 1 }))
  })
  const written =
    listed &&
    (await attempt('write', async () => {
      const put = { Bucket, Key, Body: CHECK_TEXT, ContentType: 'text/plain' }
      await client.send(new PutObjectCommand(put))
    }))
  if (written) {
    await attempt('read', async () => {
      const answer = await client.send(new GetObjectCommand({ Bucket, Key }))
      const bytes = await answer.Body?.transformToByteArray()
      if (!bytes || Buffer.compare(Buffer.from(bytes), Buffer.from(CHECK_TEXT)) !== 0) {
        throw new Error('GetObject gave other bytes than were written')
      }
    })
  }
  // Review N-2: a failed write may still have stored the file (a timeout after it landed), so
  // the delete follows any write that was tried. After a failed write its own failure is logged
  // but neither decides the reason nor reports a left file.
  let deleted = true
  if (listed) {
    deleted = await attempt('delete', async () => {
      const Delete = { Objects: [{ Key }], Quiet: true }
      const answer = await client.send(new DeleteObjectsCommand({ Bucket, Delete }))
      const failed = answer.Errors?.[0]
      if (failed) throw new DeleteError(failed.Code ?? 'Unknown', failed.Message ?? '')
    })
  }

  const first = failures[0]
  if (!first) return { ok: true }
  const detail = failures.map((failure) => detailOf(failure, keys)).join('; ')
  return { ok: false, ...reasonOf(first), leftFile: written && !deleted, detail }
}

// `requestHandler` replaces the real HTTP handler in tests; the pin still wraps it.
export async function checkS3Access(
  ctx: AdapterContext,
  options: { requestHandler?: PinnableHandler } = {},
): Promise<S3CheckOutcome> {
  let setup: S3Setup
  try {
    setup = buildS3Client(ctx, options.requestHandler)
  } catch (error) {
    const detail = detailOf({ step: 'list', error }, [])
    return { ok: false, reason: 's3_check_failed', leftFile: false, detail }
  }
  return runS3Check(setup)
}

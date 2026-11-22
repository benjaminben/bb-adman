// The S3 settings check (spec/storage-and-publish.md "Hand-test storage command", "Test
// connection (S3)"), its one owner. Used by storage.checkS3, publish.run and publish.inspect.
import type { CoreDeps } from '@/main/core-deps'
import { AppError } from '@/shared/schemas/result'

// [1.21] F-02: S3 with no settings saved, an empty bucket or ([1.40] AA6) an empty region,
// before the adapter is reached.
export function requireS3Settings(deps: Pick<CoreDeps, 'settings'>): void {
  const s3 = deps.settings.get().storage.s3
  if (s3 === null || s3.bucket === '' || s3.region === '') {
    throw new AppError(
      'RULE_VIOLATION',
      'Amazon S3 is not set up yet. Enter a bucket and a region, then try again.',
      { reason: 'storage_not_set_up', provider: 's3' },
    )
  }
}

// The storage command domain (SPEC 12): storage.checkS3 (spec/storage-and-publish.md "Test
// connection (S3)"). The Dropbox commands join it in Phase 9.
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { storageCheckS3 } from './check-s3'

export function storageCommands(deps: CoreDeps): CommandHandler[] {
  return [storageCheckS3(deps)]
}

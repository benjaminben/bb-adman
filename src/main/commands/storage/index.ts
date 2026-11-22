// The storage command domain (SPEC 12): storage.checkS3 (spec/storage-and-publish.md "Test
// connection (S3)") and the three Dropbox commands (spec/phases/phase-09.md "The sign-in
// redirect"). Each Dropbox file's slice replaces its body; this list does not change.
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { storageCheckS3 } from './check-s3'
import { storageDropboxSignIn } from './dropbox-sign-in'
import { storageDropboxSignOut } from './dropbox-sign-out'
import { storageSetDropboxFolder } from './set-dropbox-folder'

export function storageCommands(deps: CoreDeps): CommandHandler[] {
  return [
    storageCheckS3(deps),
    storageDropboxSignIn(deps),
    storageDropboxSignOut(deps),
    storageSetDropboxFolder(deps),
  ]
}

// storage.dropboxSignOut (spec/phases/phase-09.md "The sign-in redirect", A-215). App-scope,
// agent policy deny. Stub (P9-1): refuses before it reads or deletes anything, until P9-5
// replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { publishRefusal } from '@/shared/publish/messages'
import { storageDropboxSignOutInput } from '@/shared/schemas/commands/storage'

export function storageDropboxSignOut(_deps: CoreDeps) {
  return defineCommand({
    name: 'storage.dropboxSignOut',
    input: storageDropboxSignOutInput,
    changesAppState: true,
    run(): HandlerResult<null> {
      throw publishRefusal('not_built_yet')
    },
  })
}

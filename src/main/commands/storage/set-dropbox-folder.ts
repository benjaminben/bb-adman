// storage.setDropboxFolder (spec/phases/phase-09.md "Dropbox tokens", A-213): the one writer of
// settings.storage.dropbox.rootPath. App-scope, agent policy deny. Stub (P9-1): refuses before
// it reads or writes the settings, until P9-5 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { publishRefusal } from '@/shared/publish/messages'
import { storageSetDropboxFolderInput } from '@/shared/schemas/commands/storage'

export function storageSetDropboxFolder(_deps: CoreDeps) {
  return defineCommand({
    name: 'storage.setDropboxFolder',
    input: storageSetDropboxFolderInput,
    changesAppState: true,
    run(): HandlerResult<{ rootPath: string }> {
      throw publishRefusal('not_built_yet')
    },
  })
}

// storage.setDropboxFolder (spec/phases/phase-09.md "Dropbox tokens", A-213): the one writer of
// settings.storage.dropbox.rootPath. App-scope, agent policy deny. Order: signed in (the refresh
// token is saved), then the folder check, then the save. The account name is kept as it is.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { isDropboxRootPath } from '@/main/providers/dropbox/root-path'
import { publishRefusal } from '@/shared/publish/messages'
import { storageSetDropboxFolderInput } from '@/shared/schemas/commands/storage'

type Deps = Pick<CoreDeps, 'secrets' | 'settings'>

export function storageSetDropboxFolder(deps: Deps) {
  return defineCommand({
    name: 'storage.setDropboxFolder',
    input: storageSetDropboxFolderInput,
    changesAppState: true,
    run(_ctx, { rootPath }): HandlerResult<{ rootPath: string }> {
      if (deps.secrets.get('dropbox.refreshToken') === undefined) {
        throw publishRefusal('dropbox_not_signed_in')
      }
      if (!isDropboxRootPath(rootPath)) throw publishRefusal('dropbox_folder_refused')
      const accountName = deps.settings.get().storage.dropbox?.accountName ?? ''
      deps.settings.setDropbox({ accountName, rootPath })
      return { data: { rootPath } }
    },
  })
}

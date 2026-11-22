// storage.dropboxSignOut (spec/phases/phase-09.md "The sign-in redirect", A-215). App-scope,
// agent policy deny. Order: revoke at Dropbox (best effort; a failure is logged by kind only),
// forget every access token held in memory, delete the refresh token, clear the settings. Being
// offline still signs out on this computer.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { forgetDropboxAccess } from '@/main/providers/dropbox/access-token'
import { revokeQuietly } from '@/main/providers/dropbox/sign-in/session'
import { storageDropboxSignOutInput } from '@/shared/schemas/commands/storage'

type Deps = Pick<CoreDeps, 'secrets' | 'settings' | 'dropboxFetch' | 'log'>

export function storageDropboxSignOut(deps: Deps) {
  return defineCommand({
    name: 'storage.dropboxSignOut',
    input: storageDropboxSignOutInput,
    changesAppState: true,
    async run(ctx): Promise<HandlerResult<null>> {
      const refreshToken = deps.secrets.get('dropbox.refreshToken')
      const step = { name: 'storage.dropboxSignOut', actor: ctx.actor, commandId: ctx.commandId }
      if (refreshToken !== undefined) await revokeQuietly(deps, refreshToken, step)
      forgetDropboxAccess()
      if (refreshToken !== undefined) deps.secrets.delete('dropbox.refreshToken')
      deps.settings.setDropbox(null)
      return { data: null }
    },
  })
}

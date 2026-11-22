// storage.dropboxSignOut (spec/phases/phase-09.md "The sign-in redirect", A-215). App-scope,
// agent policy deny. Order: revoke at Dropbox (best effort; a failure is logged by kind only),
// forget every access token held in memory, delete the refresh token, clear the settings. Being
// offline still signs out on this computer. P9-5b: it refuses while a sign-in runs, and while the
// saved token cannot be known to be gone (secure storage unavailable, or the keys file cannot be
// read), so it never replies done with the token still on disk.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { forgetDropboxAccess } from '@/main/providers/dropbox/access-token'
import {
  dropboxSignInBusy,
  revokeQuietly,
  setDropboxSigningOut,
} from '@/main/providers/dropbox/sign-in/session'
import { INSECURE_MESSAGE } from '@/main/secrets/secret-store'
import { publishRefusal } from '@/shared/publish/messages'
import { AppError } from '@/shared/schemas/result'
import { storageDropboxSignOutInput } from '@/shared/schemas/commands/storage'

type Deps = Pick<CoreDeps, 'secrets' | 'settings' | 'dropboxFetch' | 'log'>

export const SIGN_OUT_UNREADABLE_MESSAGE =
  'Saved keys could not be read, so Adman did not sign out of Dropbox. Nothing was changed.'

function refuseUnlessKnown(deps: Deps): void {
  if (dropboxSignInBusy()) throw publishRefusal('sign_in_in_progress')
  if (!deps.secrets.canStore()) {
    throw new AppError('RULE_VIOLATION', INSECURE_MESSAGE, {
      reason: 'secure_storage_unavailable',
    })
  }
  if (!deps.secrets.readable()) {
    throw new AppError('RULE_VIOLATION', SIGN_OUT_UNREADABLE_MESSAGE, {
      reason: 'secrets_unreadable',
    })
  }
}

export function storageDropboxSignOut(deps: Deps) {
  return defineCommand({
    name: 'storage.dropboxSignOut',
    input: storageDropboxSignOutInput,
    changesAppState: true,
    async run(ctx): Promise<HandlerResult<null>> {
      refuseUnlessKnown(deps)
      // P9-6: a sign-in refuses sign_in_in_progress until this has finished.
      setDropboxSigningOut(true)
      try {
        const refreshToken = deps.secrets.get('dropbox.refreshToken')
        const step = { name: 'storage.dropboxSignOut', actor: ctx.actor, commandId: ctx.commandId }
        if (refreshToken !== undefined) await revokeQuietly(deps, refreshToken, step)
        forgetDropboxAccess()
        if (refreshToken !== undefined) deps.secrets.delete('dropbox.refreshToken')
        deps.settings.setDropbox(null)
      } finally {
        setDropboxSigningOut(false)
      }
      return { data: null }
    },
  })
}

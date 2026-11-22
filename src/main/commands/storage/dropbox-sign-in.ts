// storage.dropboxSignIn (spec/phases/phase-09.md "The sign-in redirect"; security class full).
// App-scope, agent policy deny. The browser sign-in with PKCE runs in session.ts, one at a time.
// The reply is { accountName } only, never a token, a code or the authorize address.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import {
  signInToDropbox,
  type SignInDeps,
  type SignInOptions,
} from '@/main/providers/dropbox/sign-in/session'
import {
  storageDropboxSignInInput,
  type DropboxSignInResult,
} from '@/shared/schemas/commands/storage'

// Tests give a short time-out; the app uses the 5 minutes of the spec.
export function storageDropboxSignIn(deps: SignInDeps, options: SignInOptions = {}) {
  return defineCommand({
    name: 'storage.dropboxSignIn',
    input: storageDropboxSignInInput,
    changesAppState: true,
    async run(ctx): Promise<HandlerResult<DropboxSignInResult>> {
      const step = { name: 'storage.dropboxSignIn', actor: ctx.actor, commandId: ctx.commandId }
      return { data: await signInToDropbox(deps, step, options) }
    },
  })
}

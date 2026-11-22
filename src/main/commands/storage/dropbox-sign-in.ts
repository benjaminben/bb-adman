// storage.dropboxSignIn (spec/phases/phase-09.md "The sign-in redirect"; security class full).
// App-scope, agent policy deny. Stub (P9-1): refuses before it opens a listener or the browser,
// until P9-5 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { publishRefusal } from '@/shared/publish/messages'
import {
  storageDropboxSignInInput,
  type DropboxSignInResult,
} from '@/shared/schemas/commands/storage'

export function storageDropboxSignIn(_deps: CoreDeps) {
  return defineCommand({
    name: 'storage.dropboxSignIn',
    input: storageDropboxSignInInput,
    changesAppState: true,
    run(): HandlerResult<DropboxSignInResult> {
      throw publishRefusal('not_built_yet')
    },
  })
}

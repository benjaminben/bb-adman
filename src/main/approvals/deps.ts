// deps.approvals (spec/approvals.md "Kept passwords", "Pictures"). core.ts builds it once. The
// two stores come from their own files, so AP-6 and AP-7 never edit this one.
import path from 'node:path'
import type { CoreDeps } from '@/main/core-deps'
import type { SecretCrypto } from '@/main/secrets/secret-store'
import { createPasswordStore } from './password-store'
import { choosePictureStore } from './picture-store'
import type { ApprovalsDeps } from './types'

export type ApprovalsDepsOptions = {
  userDataDir: string
  crypto: SecretCrypto
  // The core's environment, for the test picture store's condition.
  env: Record<string, string | undefined>
  // The finished CoreDeps, read when a store is chosen.
  deps: () => CoreDeps
}

export function createApprovalsDeps(opts: ApprovalsDepsOptions): ApprovalsDeps {
  return {
    passwords: createPasswordStore({
      file: path.join(opts.userDataDir, 'approval-passwords.bin'),
      crypto: opts.crypto,
    }),
    pictures: () => choosePictureStore({ deps: opts.deps(), env: opts.env }),
  }
}

// Stub (AP-5); AP-6 replaces the body with the store of spec/approvals.md "Kept passwords".
// Until then nothing is kept: read finds no password, and keep and forget refuse.
import type { SecretCrypto } from '@/main/secrets/secret-store'
import { approvalsRefusal } from '@/shared/approvals/messages'
import type { PasswordStore } from './types'

export type PasswordStoreOptions = { file: string; crypto: SecretCrypto }

export function createPasswordStore(_opts: PasswordStoreOptions): PasswordStore {
  return {
    keep() {
      throw approvalsRefusal('approvals_not_set_up')
    },
    read: () => null,
    forget() {
      throw approvalsRefusal('approvals_not_set_up')
    },
  }
}

// Stub (AP-5); AP-7 replaces the body with choosePictureStore of spec/approvals.md "Pictures":
// the test store only with dev tools and ADMAN_APPROVALS_TEST_PICTURES, else the S3 store.
// Until then every call refuses and nothing is sent or written.
import type { CoreDeps } from '@/main/core-deps'
import { approvalsRefusal } from '@/shared/approvals/messages'
import type { PictureStore } from './types'

export type PictureStoreOptions = {
  deps: CoreDeps
  env: Record<string, string | undefined>
}

const refuse = async (): Promise<never> => {
  throw approvalsRefusal('approvals_not_set_up')
}

export function choosePictureStore(_opts: PictureStoreOptions): PictureStore {
  return { put: refuse, signedUrl: refuse, list: refuse, remove: refuse }
}

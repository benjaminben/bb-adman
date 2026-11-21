// spec/approvals.md "Pictures": which picture store deps.approvals.pictures() gives. The test
// store only when dev tools are on (an unpackaged app started with ADMAN_DEV_TOOLS=1) and the
// core's environment has ADMAN_APPROVALS_TEST_PICTURES set to exactly http://127.0.0.1:{port};
// in every other case the S3 store. Nothing else chooses (A-97).
import path from 'node:path'
import type { CoreDeps } from '@/main/core-deps'
import { s3PictureStore } from './s3-picture-store'
import { TEST_PICTURES_FOLDER, testPictureStore, testPicturesOrigin } from './test-picture-store'
import type { PictureStore } from './types'

export type PictureStoreOptions = {
  deps: CoreDeps
  env: Record<string, string | undefined>
}

export function choosePictureStore({ deps, env }: PictureStoreOptions): PictureStore {
  const origin = deps.devTools ? testPicturesOrigin(env.ADMAN_APPROVALS_TEST_PICTURES) : null
  if (deps.devTools !== true || origin === null) return s3PictureStore(deps)
  const root = path.join(deps.userDataDir, TEST_PICTURES_FOLDER)
  return testPictureStore({ root, origin, now: deps.now })
}

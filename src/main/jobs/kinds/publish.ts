// The publish job kind (spec/phases/phase-09.md "Publishing"; body in src/main/publish/
// run-publish.ts). Stub (P9-1): fails every job with export_not_built until P9-10 replaces the
// body. It reads no storage, makes no work folder and uploads nothing.
import type { JobKindHandler } from '@/main/jobs/types'
import { LocalFailure } from '@/main/jobs/local-failure'

async function runPublishJob(): Promise<never> {
  throw new LocalFailure('export_not_built')
}

export function publishKind(): JobKindHandler {
  return { kind: 'publish', run: runPublishJob }
}

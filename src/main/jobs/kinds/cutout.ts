// The cutout job kind (spec/ai-jobs.md). P4-1 stub, replaced by P4-11: it fails the job with
// ProviderFailure other before any provider is called.
import type { JobKindHandler } from '@/main/jobs/types'
import { ProviderFailure } from '@/main/providers/types'

export function cutoutKind(): JobKindHandler {
  return {
    kind: 'cutout',
    run: async () => {
      throw new ProviderFailure({ kind: 'other', detail: 'Not built yet' })
    },
  }
}

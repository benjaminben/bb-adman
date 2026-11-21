// The layout_proposal job kind (spec/ai-jobs.md). P4-1 stub, replaced by P4-7: it fails the job with
// ProviderFailure other before any provider is called.
import type { JobKindHandler } from '@/main/jobs/types'
import { ProviderFailure } from '@/main/providers/types'

export function layoutProposalKind(): JobKindHandler {
  return {
    kind: 'layout_proposal',
    run: async () => {
      throw new ProviderFailure({ kind: 'other', detail: 'Not built yet' })
    },
  }
}

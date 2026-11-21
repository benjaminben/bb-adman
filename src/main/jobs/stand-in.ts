// Stand-in for the JobService until slice D builds the runner (SPEC 14, Phase 2 step 0).
// Slice D replaces this body; the type in types.ts stays. With no runner there is never a
// job to cancel or resume, so those calls do nothing.
import type { JobService } from './types'

export function createJobServiceStandIn(): JobService {
  return {
    enqueue: () => {
      throw new Error('JobService.enqueue is not built yet')
    },
    cancel: async () => undefined,
    cancelAll: async () => undefined,
    activeCount: () => 0,
    projectOpened: async () => undefined,
    markSeen: () => undefined,
  }
}

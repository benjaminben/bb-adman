// The layout_proposal job kind (spec/ai-jobs.md). P4-1 stub, replaced by P4-7: it fails the job with
// ProviderFailure other before any provider is called.
import type { JobKindHandler } from '@/main/jobs/types'
import { ProviderFailure } from '@/main/providers/types'
import type { LayerRow } from '@/shared/schemas/rows/layer'

// What the provider places: each visible text layer with copy, in the order given (z order).
export function layoutItems(layers: LayerRow[]): Array<{ slot: string; text: string }> {
  return layers
    .filter((l) => l.type === 'text' && l.visible && (l.copy ?? '').trim() !== '')
    .map((l) => ({ slot: l.key, text: l.copy ?? '' }))
}

export function layoutProposalKind(): JobKindHandler {
  return {
    kind: 'layout_proposal',
    run: async () => {
      throw new ProviderFailure({ kind: 'other', detail: 'Not built yet' })
    },
  }
}

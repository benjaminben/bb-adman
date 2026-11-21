// The export job kind (spec/phases/phase-08.md "Export run"; background [D-036]).
// Stub (P8-1): fails every job until P8-6 replaces the body. It reads no plan, draws nothing and
// writes nothing.
import type { JobKindHandler } from '@/main/jobs/types'
import { ProviderFailure } from '@/main/providers/types'
import { EXPORT_REASON_MESSAGES } from '@/shared/export/messages'

async function runExportJob(): Promise<never> {
  throw new ProviderFailure({ kind: 'other', detail: EXPORT_REASON_MESSAGES.export_not_built })
}

export function exportKind(): JobKindHandler {
  return { kind: 'export', run: runExportJob }
}

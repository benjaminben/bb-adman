// The export's checks (spec/phases/phase-08.md "Interfaces with other phases", ExportChecks).
// Stub (P8-1): every variant has no results and the report says the checks were not run, until
// P8-13 replaces the body with Phase 6's engine. It reads and stores nothing.
import type { CoreDeps } from '@/main/core-deps'
import type { ExportChecks } from './types'

export function createExportChecks(_deps: () => CoreDeps): ExportChecks {
  return {
    checksRun: false,
    async run(_project, variantIds) {
      return new Map(variantIds.map((id) => [id, []]))
    },
    store() {},
  }
}

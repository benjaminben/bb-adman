// The export report's files and row (spec/phases/phase-08.md "Report"). Stub (P8-1): writes
// nothing and gives no report ID, until P8-9 replaces the body.
import type { CoreDeps } from '@/main/core-deps'
import type { ExportReport } from './types'

export function createExportReport(_deps: () => CoreDeps): ExportReport {
  return {
    async write() {
      return null
    },
  }
}

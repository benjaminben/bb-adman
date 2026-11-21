// One video ad's export (spec/phases/phase-08.md "Video"). Stub (P8-1): every video ad fails
// with its sentence, until P8-16 replaces the body. It starts no process and writes nothing.
import type { CoreDeps } from '@/main/core-deps'
import { AD_FAILURES } from '@/shared/export/messages'
import type { ExportVideo } from './types'

export function createExportVideo(_deps: () => CoreDeps): ExportVideo {
  return {
    async exportVariant() {
      throw new Error(AD_FAILURES.videoNotBuilt)
    },
  }
}

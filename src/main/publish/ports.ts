// The publish ports (spec/phases/phase-09.md "The export interface"). The publish job reaches
// export, the checks and the storages only through these, so P9-11 adapts Phase 8 and Phase 6
// in export-adapter.ts alone, and tests hand in their own.
import type { CoreDeps } from '@/main/core-deps'
import type { StorageProvider } from '@/main/providers/types'
import type { PublishStorageId } from '@/shared/schemas/commands/publish'

// Written at the top of the report of a publish [REQ: FR-241].
export type PublishHeader = { publishedAt: string; publishNumber: number }

// One file the export wrote into the work folder. relPath is relative to the campaign folder;
// absPath is a main-process path inside the work folder.
export type ExportedFile = {
  role: 'ad' | 'report_html' | 'report_json' | 'translations_csv'
  relPath: string
  absPath: string
}

// One warning the checks found for an ad.
export type PublishWarning = { variantId: string; title: string; message: string }

export type ExportForPublishInput = {
  projectId: string
  campaignId: string
  // The work folder, a main-process folder.
  outputRoot: string
  proceedDespiteWarnings: boolean
  proceedReason: string | null
  publishHeader: PublishHeader | null
  signal: AbortSignal
  // A fraction from 0 to 1 of the export's own work.
  onProgress: (fraction: number) => void
}

export type ExportForPublishResult = { files: ExportedFile[]; variantIds: string[] }

export type PublishPorts = {
  // Exports a whole campaign inside the calling job, not as a job of its own.
  exportForPublish(deps: CoreDeps, input: ExportForPublishInput): Promise<ExportForPublishResult>
  warningsForPublish(
    deps: CoreDeps,
    input: { projectId: string; campaignId: string },
  ): Promise<PublishWarning[]>
  storageFor(deps: StorageForDeps, storage: PublishStorageId): StorageProvider
}

export type StorageForDeps = Pick<CoreDeps, 'providers' | 'secrets' | 'settings' | 'userDataDir'>

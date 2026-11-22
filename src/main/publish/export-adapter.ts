// The export ports as publish uses them (spec/phases/phase-09.md "The export interface").
// Stub (P9-1): both refuse with export_not_built, before they read or write anything, until
// P9-11 adapts Phase 8's in-job export and checks, and Phase 6's translation sheet.
import { LocalFailure } from '@/main/jobs/local-failure'
import type { ExportForPublishResult, PublishWarning } from './ports'

export function exportForPublish(): Promise<ExportForPublishResult> {
  return Promise.reject(new LocalFailure('export_not_built'))
}

export function warningsForPublish(): Promise<PublishWarning[]> {
  return Promise.reject(new LocalFailure('export_not_built'))
}

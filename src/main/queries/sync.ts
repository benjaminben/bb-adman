// The sync query domain (spec/links-and-sync.md, "Sync"): sync.preview, what syncing a
// direction would change. Both actors may read it. Stub (P5-1, A-149): checks the input and
// the project, then refuses until P5-12 replaces the body.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { openFor } from './campaign-reads'
import { syncPreviewInput, type SyncPreviewReply } from '@/shared/schemas/queries/sync'
import { AppError } from '@/shared/schemas/result'

export function syncPreview(deps: Pick<CoreDeps, 'projects'>): QueryFn {
  return (raw): SyncPreviewReply => {
    openFor(deps, syncPreviewInput, raw)
    throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
  }
}

export function syncQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'sync.preview': syncPreview(deps) }
}

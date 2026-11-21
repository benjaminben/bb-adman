// The check query domain (spec/phases/phase-06.md, design addition 1, A-165): check.results,
// the stored check of each variant that has one. Both actors may read it. Stub (P6-1): checks
// the input and the project, then answers no variants until P6-3 replaces the body.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { openFor } from './campaign-reads'
import { checkResultsInput, type CheckResultsReply } from '@/shared/schemas/queries/check'

export function checkResults(deps: Pick<CoreDeps, 'projects'>): QueryFn {
  return (raw): CheckResultsReply => {
    openFor(deps, checkResultsInput, raw)
    return { variants: [] }
  }
}

export function checkQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'check.results': checkResults(deps) }
}

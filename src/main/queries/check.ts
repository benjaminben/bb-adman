// The check query domain (spec/phases/phase-06.md, design addition 1, A-165): check.results,
// the stored check of each variant that has one, read from the input's own open project file.
// Both actors may read it. A named variant not in that file answers NOT_FOUND.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { openFor } from './campaign-reads'
import { requireVariant } from './variant-reads'
import { targetVariantIds } from '@/main/checks/read-input'
import { readWireRow } from '@/main/db/rows'
import {
  checkResultsInput,
  type CheckResultsReply,
  type VariantCheckState,
} from '@/shared/schemas/queries/check'
import type { VariantCheckRow } from '@/shared/schemas/rows/variant-check'

export function checkResults(deps: Pick<CoreDeps, 'projects'>): QueryFn {
  return (raw): CheckResultsReply => {
    const { input, project } = openFor(deps, checkResultsInput, raw)
    const db = project.db
    const variants: VariantCheckState[] = []
    for (const id of targetVariantIds(db, input)) {
      const { variant } = requireVariant(db, id)
      const row = readWireRow(db, 'variant_check', { variantId: id }) as VariantCheckRow | null
      if (!row) continue
      variants.push({
        variantId: id,
        rev: variant.rev,
        checkedRev: row.checkedRev,
        stale: row.checkedRev < variant.rev,
        ranAt: row.ranAt,
        ranBy: row.ranBy,
        results: row.results,
      })
    }
    return { variants }
  }
}

export function checkQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'check.results': checkResults(deps) }
}

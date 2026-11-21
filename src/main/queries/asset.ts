// The asset query domain (SPEC 12). Empty in Phase 2 step 0; its slice adds the queries.
import type { CoreDeps } from '../core-deps'
import type { QueryFn } from './types'
import { readWireRow, readWireRows } from '../db/rows'
import { resolveRow } from '../assets/service'
import { assetListInput, type AssetList } from '../../shared/schemas/queries/asset'
import type { AssetRow } from '../../shared/schemas/rows/asset'
import { AppError } from '../../shared/schemas/result'

// SPEC 4.3 asset.list. Unknown filter values are INVALID_INPUT, a subject the project does
// not hold is NOT_FOUND (SPEC 4.1).
export function assetList(deps: Pick<CoreDeps, 'projects'>): QueryFn {
  return async (raw): Promise<AssetList> => {
    const parsed = assetListInput.safeParse(raw)
    if (!parsed.success) throw new AppError('INVALID_INPUT', 'Some values are not valid.')
    const { projectId, library, kind, subjectId } = parsed.data
    const project = deps.projects.requireOpen(projectId)
    if (subjectId && !readWireRow(project.db, 'subject', { id: subjectId })) {
      throw new AppError('NOT_FOUND', 'That subject is not in this project.')
    }
    const rows = (readWireRows(project.db, 'asset') as AssetRow[]).filter(
      (r) =>
        (!library || r.library === library) &&
        (!kind || r.kind === kind) &&
        (!subjectId || r.subjectId === subjectId),
    )
    const found = await Promise.all(rows.map((r) => resolveRow(project, r)))
    return rows.map((r, i) => ({ ...r, missing: found[i] === 'missing' }))
  }
}

export function assetQueries(_deps: CoreDeps): Record<string, QueryFn> {
  return {}
}

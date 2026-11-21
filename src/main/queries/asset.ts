// The asset query domain (SPEC 12; SPEC 14, Slice A part 2, A2-1).
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { readWireRow, readWireRows } from '@/main/db/rows'
import { resolveRow } from '@/main/assets/service'
import { assetListInput, type AssetList } from '@/shared/schemas/queries/asset'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import { AppError } from '@/shared/schemas/result'

// SPEC 4.3 asset.list. Unknown filter values are INVALID_INPUT, a subject the project does
// not hold is NOT_FOUND (SPEC 4.1). Rows come by id, ascending: IDs are ULIDs, so oldest
// first and the same on every call (SPEC 14, Slice A rulings point 7).
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
    rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const found = await Promise.all(rows.map((r) => resolveRow(project, r)))
    return rows.map((r, i) => ({ ...r, missing: found[i] === 'missing' }))
  }
}

export function assetQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'asset.list': assetList(deps) }
}

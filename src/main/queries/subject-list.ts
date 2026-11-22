// subject.list (spec/phases/phase-10.md, "Design additions", A-235). Both actors: the subjects
// of an open project by ID, each with the IDs of the asset rows whose subject it is, by ID. A
// row that cannot be read is left out and logged by readWireRows. A query never writes.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { openFor } from './campaign-reads'
import { readWireRows } from '@/main/db/rows'
import { subjectListInput, type SubjectList } from '@/shared/schemas/queries/subject'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { SubjectRow } from '@/shared/schemas/rows/subject'

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

function subjectList(deps: Pick<CoreDeps, 'projects' | 'log'>): QueryFn {
  return (raw): SubjectList => {
    const { project } = openFor(deps, subjectListInput, raw)
    const assets = (readWireRows(project.db, 'asset', deps.log) as AssetRow[]).sort(byId)
    const subjects = (readWireRows(project.db, 'subject', deps.log) as SubjectRow[]).sort(byId)
    return subjects.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      assetIds: assets.filter((a) => a.subjectId === s.id).map((a) => a.id),
    }))
  }
}

export function subjectListQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'subject.list': subjectList(deps) }
}

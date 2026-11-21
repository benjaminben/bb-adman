// project.listOpen (MCP-D; SPEC api-queries-events): each open project's ID and name, named
// field by field so the file path never leaves (FR-198, FR-201). App scope, no input. Open to
// both actors; the MCP tool list_projects maps to it one to one.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { readMeta } from '@/main/db/meta'
import type { ProjectListOpen } from '@/shared/schemas/queries/project'

export function projectListOpen(deps: Pick<CoreDeps, 'projects'>): QueryFn {
  return (): ProjectListOpen =>
    deps.projects.all().map((h) => ({ id: h.projectId, name: readMeta(h.db).name }))
}

export function projectListOpenQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'project.listOpen': projectListOpen(deps) }
}

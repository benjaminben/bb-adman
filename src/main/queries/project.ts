// The project query domain (SPEC 12, 4.3; SPEC 14, slice C). project.get: project meta,
// subjects, campaign summaries with job marks, and the missing asset count. The count comes
// from AssetService.missingAssetIds, the one call slice C makes on it (SPEC 14 contracts).
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { readWireRows } from '@/main/db/rows'
import { readMeta } from '@/main/db/meta'
import { jobMarks, openFor } from './campaign-reads'
import { projectGetInput, type ProjectGet } from '@/shared/schemas/queries/campaign'
import type { CampaignRow } from '@/shared/schemas/rows/campaign'
import type { SubjectRow } from '@/shared/schemas/rows/subject'

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export function projectGet(deps: Pick<CoreDeps, 'projects' | 'assets' | 'log'>): QueryFn {
  return async (raw): Promise<ProjectGet> => {
    const { project } = openFor(deps, projectGetInput, raw)
    const stored = readMeta(project.db)
    const meta = {
      projectId: stored.projectId,
      name: stored.name,
      schemaVersion: stored.schemaVersion,
      createdAppVersion: stored.createdAppVersion,
      createdAt: stored.createdAt,
    }
    // [1.42] the number of variants in all the campaign's directions.
    const countVariants = project.db.prepare<[string], { n: number }>(
      `SELECT COUNT(*) AS n FROM variant v JOIN direction d ON d.id = v.direction_id
       WHERE d.campaign_id = ?`,
    )
    const subjects = (readWireRows(project.db, 'subject', deps.log) as SubjectRow[]).sort(byId)
    const campaigns = (readWireRows(project.db, 'campaign', deps.log) as CampaignRow[])
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || byId(a, b))
      .map((c) => ({
        id: c.id,
        name: c.name,
        region: c.region,
        primaryLanguage: c.primaryLanguage,
        createdBy: c.createdBy,
        createdAt: c.createdAt,
        ...jobMarks(project.db, 'campaign_id', c.id),
        variantCount: countVariants.get(c.id)?.n ?? 0,
      }))
    const missingAssetCount = (await deps.assets.missingAssetIds(project)).length
    return { meta, subjects, campaigns, missingAssetCount }
  }
}

export function projectQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'project.get': projectGet(deps) }
}

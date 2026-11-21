// job.earlierOptions (spec/ai-jobs.md "The three queries") [REQ: FR-248, FR-216]: the picture
// cut-out and fill runs of a layer, with the pictures they kept. It calls no provider.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { newestFirst } from './activity'
import { readWireRows } from '@/main/db/rows'
import { resolveRow } from '@/main/assets/service'
import type { ProjectHandle } from '@/main/db/project-file'
import {
  jobEarlierOptionsInput,
  type EarlierOption,
  type EarlierOptions,
} from '@/shared/schemas/queries/earlier-options'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { JobRow } from '@/shared/schemas/rows/job'
import { AppError } from '@/shared/schemas/result'

const MAX_RUNS = 50
// P5-8: a fill is listed with the background layer's other runs.
const RUN_KINDS: ReadonlySet<JobRow['kind']> = new Set([
  'image_generation',
  'cutout',
  'generative_fill',
])

type LayerPlace = { variant_id: string; slot: string | null }

// The IDs in result.assetIds; a run with no result yet, or another shape, kept none.
function keptIds(job: JobRow): string[] {
  const result = job.result
  if (typeof result !== 'object' || result === null || !('assetIds' in result)) return []
  const ids: unknown = result.assetIds
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
}

async function withAssets(
  project: ProjectHandle,
  job: JobRow,
  assets: Map<string, AssetRow>,
): Promise<EarlierOption> {
  const rows = keptIds(job).flatMap((id) => assets.get(id) ?? [])
  const found = await Promise.all(rows.map((r) => resolveRow(project, r)))
  return {
    job,
    assets: rows.map((r, i) => ({
      assetId: r.id,
      width: r.width ?? 0,
      height: r.height ?? 0,
      missing: found[i] === 'missing',
    })),
  }
}

export function earlierOptions(deps: Pick<CoreDeps, 'projects' | 'log'>): QueryFn {
  return async (raw): Promise<EarlierOptions> => {
    const parsed = jobEarlierOptionsInput.safeParse(raw)
    if (!parsed.success) throw new AppError('INVALID_INPUT', 'Some values are not valid.')
    const { projectId, layerId } = parsed.data
    const project = deps.projects.requireOpen(projectId)
    const layer = project.db
      .prepare('SELECT variant_id, slot FROM layer WHERE id = ?')
      .get(layerId) as LayerPlace | undefined
    if (!layer) throw new AppError('NOT_FOUND', 'That layer was not found.')
    const runs = (readWireRows(project.db, 'job', deps.log) as JobRow[])
      .filter(
        (j) =>
          RUN_KINDS.has(j.kind) &&
          (j.layerId === layerId ||
            (layer.slot !== null && j.slot === layer.slot && j.variantId === layer.variant_id)),
      )
      .sort(newestFirst)
      .slice(0, MAX_RUNS)
    const assetRows = readWireRows(project.db, 'asset', deps.log) as AssetRow[]
    const assets = new Map(assetRows.map((a) => [a.id, a]))
    return Promise.all(runs.map((job) => withAssets(project, job, assets)))
  }
}

export function earlierOptionsQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'job.earlierOptions': earlierOptions(deps) }
}

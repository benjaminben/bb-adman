// project.setAssetsDir (SPEC 4.2; SPEC 14, Slice A rulings point 4; FR-007, R-07). Not
// undoable. Refused while a job is queued or running, because a job writes its file and then
// adds its row, and both must see the same folder.
import { eq } from 'drizzle-orm'
import { defineCommand } from '../types'
import type { CoreDeps } from '../../core-deps'
import { asset, projectMeta } from '../../db/schema'
import { readWireRow } from '../../db/rows'
import { prepareAssetsDir } from '../../assets/assets-dir'
import { projectSetAssetsDirInput } from '../../../shared/schemas/commands/asset'
import { AppError } from '../../../shared/schemas/result'
import type { AssetRow } from '../../../shared/schemas/rows/asset'

function requireNoJobs(deps: Pick<CoreDeps, 'jobs'>, projectId: string): void {
  if (deps.jobs.activeCount(projectId) > 0) {
    throw new AppError(
      'RULE_VIOLATION',
      'Wait for the running work to finish, then change the assets folder.',
      { reason: 'jobs_running' },
    )
  }
}

export function projectSetAssetsDir(deps: Pick<CoreDeps, 'jobs'>) {
  return defineCommand({
    name: 'project.setAssetsDir',
    input: projectSetAssetsDirInput,
    projectId: (input) => input.projectId,
    prepare: async (ctx, input) => {
      requireNoJobs(deps, input.projectId)
      return prepareAssetsDir(ctx.project, input.dir)
    },
    run(ctx, input, prepared) {
      requireNoJobs(deps, input.projectId)
      const meta = { assets_dir_rel: prepared.dirRel, assets_dir_abs: prepared.dir }
      for (const [key, value] of Object.entries(meta)) {
        ctx.project.orm
          .insert(projectMeta)
          .values({ key, value })
          .onConflictDoUpdate({ target: projectMeta.key, set: { value } })
          .run()
        ctx.changes.touch('project_meta', { key })
      }
      const repointedAssetIds: string[] = []
      for (const { id, ...paths } of prepared.repoints) {
        const row = readWireRow(ctx.project.db, 'asset', { id }) as AssetRow | null
        if (row?.storage !== 'managed') continue
        ctx.project.orm.update(asset).set(paths).where(eq(asset.id, id)).run()
        ctx.changes.touch('asset', { id })
        repointedAssetIds.push(id)
      }
      return { data: { assetsDir: prepared.dir, repointedAssetIds } }
    },
  })
}

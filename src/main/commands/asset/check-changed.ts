// asset.checkChanged (SPEC 14, Slice A rulings point 2b; FR-009, R-06). A system command no
// window may send; agent policy deny; not undoable. Sent by assets/change-trigger.ts after a
// project opens and when a window gains focus. Reply: the assets whose content changed.
import { eq } from 'drizzle-orm'
import { defineCommand } from '../types'
import type { CoreDeps } from '../../core-deps'
import { asset } from '../../db/schema'
import { readWireRow } from '../../db/rows'
import { changePatch, prepareCheckChanged } from '../../assets/check-changed'
import { assetCheckChangedInput } from '../../../shared/schemas/commands/asset'
import type { AssetRow } from '../../../shared/schemas/rows/asset'

export function assetCheckChanged(deps: Pick<CoreDeps, 'log'>) {
  const note = (level: 'info' | 'warn', projectId: string, message: string) =>
    deps.log.write({
      level,
      event: 'asset',
      name: 'asset.checkChanged',
      actor: 'system',
      ok: true,
      projectId,
      message,
    })

  return defineCommand({
    name: 'asset.checkChanged',
    internal: true,
    input: assetCheckChangedInput,
    projectId: (input) => input.projectId,
    prepare: (ctx) => prepareCheckChanged(ctx.project),
    run(ctx, input, prepared) {
      const assetIds: string[] = []
      for (const { id, facts } of prepared) {
        const row = readWireRow(ctx.project.db, 'asset', { id }) as AssetRow | null
        if (row?.storage !== 'linked') continue
        const { patch, outcome } = changePatch(row, facts)
        ctx.project.orm.update(asset).set(patch).where(eq(asset.id, id)).run()
        ctx.changes.touch('asset', { id })
        if (outcome === 'time') continue
        assetIds.push(id)
        note('info', input.projectId, `Asset ${id} changed on disk.`)
        if (outcome === 'other kind') {
          note('warn', input.projectId, `Asset ${id} now holds another kind of file.`)
        }
      }
      return { data: { assetIds } }
    },
  })
}

// layer.clearOverride (spec/links-and-sync.md, "Overrides"): removes override paths from a
// linked layer's list and writes the master's current value for each removed path. Agent
// policy deny. A path not in the list is ignored; a call that changes nothing writes nothing
// and adds no entry. Its inverse is layer.revert.
import { defineCommand } from '@/main/commands/types'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import type { CoreDeps } from '@/main/core-deps'
import { readWireRow } from '@/main/db/rows'
import { masterPatchOf } from '@/shared/links/override-paths'
import { layerClearOverrideInput, type LayerPatch } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { AppError } from '@/shared/schemas/result'
import { inversePatch } from './inverse-patch'
import { mergePatch, type PatchKey } from './merge-patch'
import { followedMaster, revertInverse, writeLayer } from './write-layer'

export function layerClearOverride(deps: CoreDeps) {
  return defineCommand({
    name: 'layer.clearOverride',
    input: layerClearOverrideInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const db = ctx.project.db
      const row = readWireRow(db, 'layer', { id: input.layerId }) as LayerRow | null
      if (!row) throw new AppError('NOT_FOUND', 'That layer was not found.')
      const link = followedMaster(db, row)
      if (!link) {
        throw new AppError('RULE_VIOLATION', 'This layer does not follow the master.', {
          reason: 'not_linked',
        })
      }
      const result = { data: { layerId: row.id }, log: { variantId: row.variantId } }
      const removed = row.overrides.filter((path) => input.paths.includes(path))
      if (removed.length === 0) return result
      const overrides = row.overrides.filter((path) => !removed.includes(path))
      // The values come from the master's own row, not from the input, so the asset checks of
      // layer.update do not run. A master without this key gives no value: only the list changes.
      const source = link.master.layers.find((layer) => layer.key === row.key)
      const patch = (source ? masterPatchOf(source, removed) : {}) as LayerPatch
      const merged = mergePatch(row, patch)
      const inverse = inversePatch(row, merged)
      writeLayer(ctx, row, merged, Object.keys(inverse) as PatchKey[], overrides)
      bumpVariantRev(ctx, row.variantId, deps.now().toISOString())
      const item = { layerId: row.id, patch: inverse, overrides: row.overrides }
      return { ...result, inverse: revertInverse(input.projectId, row.variantId, [item]) }
    },
  })
}

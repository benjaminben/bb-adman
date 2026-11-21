// layer.update (spec/editor-commands.md; FR-091 to FR-094, FR-194, FR-249). Undoable on the
// variant's list. Writes only what really changes: one counter per changed group
// (spec/data-rules.md, "Links"), variant.rev once. A patch equal to what is stored writes
// nothing and adds no undo entry.
import type { CoreDeps } from '@/main/core-deps'
import { defineCommand } from '@/main/commands/types'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import { readWireRow } from '@/main/db/rows'
import { AppError } from '@/shared/schemas/result'
import { layerUpdateInput } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { checkLayerAssets } from './check-layer-assets'
import { inversePatch } from './inverse-patch'
import { mergePatch, type PatchKey } from './merge-patch'
import { writeLayer } from './write-layer'

export function layerUpdate(deps: CoreDeps) {
  return defineCommand({
    name: 'layer.update',
    input: layerUpdateInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const row = readWireRow(ctx.project.db, 'layer', { id: input.layerId }) as LayerRow | null
      if (!row) throw new AppError('NOT_FOUND', 'That layer was not found.')
      const merged = mergePatch(row, input.patch)
      checkLayerAssets(ctx.project.db, input.patch)
      const inverse = inversePatch(row, merged)
      const keys = Object.keys(inverse) as PatchKey[]
      const result = { data: { layerId: row.id }, log: { variantId: row.variantId } }
      if (keys.length === 0) return result
      writeLayer(ctx, row, merged, keys)
      bumpVariantRev(ctx, row.variantId, deps.now().toISOString())
      const call = {
        name: 'layer.update',
        input: { projectId: input.projectId, layerId: row.id, patch: inverse },
      }
      return { ...result, inverse: { scope: `variant:${row.variantId}`, call } }
    },
  })
}

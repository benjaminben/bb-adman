// layer.updateMany (spec/ai-jobs.md "Layout proposal"). Many layer.update patches on one
// variant as one command: every item follows layer.update (merge, type, style and asset
// checks, counters), any refusal refuses the whole command (it runs in one transaction and
// checks every item before it writes), variant.rev is bumped once and one inverse goes on the
// variant's list. Open to agents, so every item gets the same checks as layer.update.
import type { CoreDeps } from '@/main/core-deps'
import { defineCommand, type ProjectContext } from '@/main/commands/types'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import { readWireRow } from '@/main/db/rows'
import { AppError } from '@/shared/schemas/result'
import { layerUpdateManyInput, type LayerUpdateManyInput } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { checkLayerAssets } from './check-layer-assets'
import { inversePatch } from './inverse-patch'
import { mergePatch, type MergedValues, type PatchKey } from './merge-patch'
import { writeLayer } from './write-layer'

type Planned = { row: LayerRow; merged: MergedValues; inverse: Record<string, unknown> }

// Every check of every item, in layer.update's order, before anything is written.
function plan(ctx: ProjectContext, input: LayerUpdateManyInput): Planned[] {
  const ids = input.updates.map((update) => update.layerId)
  if (new Set(ids).size !== ids.length) {
    throw new AppError('INVALID_INPUT', 'Name each layer once.')
  }
  return input.updates.map(({ layerId, patch }) => {
    const row = readWireRow(ctx.project.db, 'layer', { id: layerId }) as LayerRow | null
    if (!row || row.variantId !== input.variantId) {
      throw new AppError('NOT_FOUND', 'That layer was not found.')
    }
    const merged = mergePatch(row, patch)
    checkLayerAssets(ctx.project.db, patch)
    return { row, merged, inverse: inversePatch(row, merged) }
  })
}

export function layerUpdateMany(deps: CoreDeps) {
  return defineCommand({
    name: 'layer.updateMany',
    input: layerUpdateManyInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const changed = plan(ctx, input).filter((item) => Object.keys(item.inverse).length > 0)
      const layerIds = changed.map((item) => item.row.id)
      const result = { data: { layerIds }, log: { variantId: input.variantId } }
      if (changed.length === 0) return result
      for (const { row, merged, inverse } of changed) {
        writeLayer(ctx, row, merged, Object.keys(inverse) as PatchKey[])
      }
      bumpVariantRev(ctx, input.variantId, deps.now().toISOString())
      const updates = changed.map((item) => ({ layerId: item.row.id, patch: item.inverse }))
      const call = {
        name: 'layer.updateMany',
        input: { projectId: input.projectId, variantId: input.variantId, updates },
      }
      return { ...result, inverse: { scope: `variant:${input.variantId}`, call } }
    },
  })
}

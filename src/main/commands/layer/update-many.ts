// layer.updateMany (spec/ai-jobs.md "Layout proposal"). Many layer.update patches on one
// variant as one command: every item follows layer.update (merge, type, style and asset
// checks, counters), any refusal refuses the whole command (it runs in one transaction and
// checks every item before it writes), variant.rev is bumped once and one inverse goes on the
// variant's list. Open to agents, so every item gets the same checks as layer.update. When an
// override list changes, that inverse is one layer.revert (spec/links-and-sync.md, A-136).
import type { CoreDeps } from '@/main/core-deps'
import type Database from 'better-sqlite3'
import { defineCommand, type ProjectContext } from '@/main/commands/types'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import { readWireRow } from '@/main/db/rows'
import { AppError } from '@/shared/schemas/result'
import {
  layerUpdateManyInput,
  type LayerPatch,
  type LayerUpdateManyInput,
} from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { checkLayerAssets } from './check-layer-assets'
import { inversePatch } from './inverse-patch'
import { mergePatch, type MergedValues, type PatchKey } from './merge-patch'
import { overridesAfter, revertInverse, writeLayer } from './write-layer'

export type Planned = { row: LayerRow; merged: MergedValues; inverse: Record<string, unknown> }

// One item's checks, in layer.update's order: a layer of this variant, then the merge, then the
// assets. Shared with layer.revert.
export function planLayer(
  db: Database.Database,
  variantId: string,
  layerId: string,
  patch: LayerPatch,
): Planned {
  const row = readWireRow(db, 'layer', { id: layerId }) as LayerRow | null
  if (!row || row.variantId !== variantId) {
    throw new AppError('NOT_FOUND', 'That layer was not found.')
  }
  const merged = mergePatch(row, patch)
  checkLayerAssets(db, patch)
  return { row, merged, inverse: inversePatch(row, merged) }
}

// Refuses a list that names a layer twice.
export function namedOnce(ids: string[]): void {
  if (new Set(ids).size !== ids.length) {
    throw new AppError('INVALID_INPUT', 'Name each layer once.')
  }
}

// Every check of every item, in layer.update's order, before anything is written.
function plan(ctx: ProjectContext, input: LayerUpdateManyInput): Planned[] {
  namedOnce(input.updates.map((update) => update.layerId))
  return input.updates.map(({ layerId, patch }) =>
    planLayer(ctx.project.db, input.variantId, layerId, patch),
  )
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
      const lists = changed.map((item) => overridesAfter(ctx.project.db, item.row, item.inverse))
      changed.forEach(({ row, merged, inverse }, i) => {
        writeLayer(ctx, row, merged, Object.keys(inverse) as PatchKey[], lists[i] ?? undefined)
      })
      bumpVariantRev(ctx, input.variantId, deps.now().toISOString())
      if (lists.some((list) => list !== null)) {
        const layers = changed.map(({ row, inverse }) => ({
          layerId: row.id,
          patch: inverse,
          overrides: row.overrides,
        }))
        return { ...result, inverse: revertInverse(input.projectId, input.variantId, layers) }
      }
      const updates = changed.map((item) => ({ layerId: item.row.id, patch: item.inverse }))
      const call = {
        name: 'layer.updateMany',
        input: { projectId: input.projectId, variantId: input.variantId, updates },
      }
      return { ...result, inverse: { scope: `variant:${input.variantId}`, call } }
    },
  })
}

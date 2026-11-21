// layer.create (spec/editor-commands.md; FR-090, FR-194): adds a picture or text layer on top of
// the variant. Starts from newLayerValues, merges the given values as layer.update merges a
// patch, and puts layer.delete on the variant's undo list.
import { ulid } from 'ulid'
import type { CoreDeps } from '@/main/core-deps'
import { defineCommand } from '@/main/commands/types'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import { insertLayerRow } from '@/main/commands/campaign/layer-row'
import { AppError } from '@/shared/schemas/result'
import { layerCreateInput } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { newLayerValues } from '@/shared/templates/new-layer'
import { checkLayerAssets } from './check-layer-assets'
import { mergePatch } from './merge-patch'

type Variant = { width: number; height: number; top: number | null; count: number }

export function layerCreate(deps: CoreDeps) {
  return defineCommand({
    name: 'layer.create',
    input: layerCreateInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const db = ctx.project.db
      const variant = db
        .prepare(
          `SELECT width, height,
             (SELECT MAX(z) FROM layer WHERE variant_id = variant.id) AS top,
             (SELECT COUNT(*) FROM layer WHERE variant_id = variant.id AND type = ?) AS count
           FROM variant WHERE id = ?`,
        )
        .get(input.type, input.variantId) as Variant | undefined
      if (!variant) throw new AppError('NOT_FOUND', 'That variant was not found.')
      const id = ulid()
      const start: LayerRow = {
        ...newLayerValues(input.type, variant, variant.count),
        id,
        variantId: input.variantId,
        key: `layer-${id.toLowerCase()}`,
        z: (variant.top ?? 0) + 1,
      }
      const values = input.values ?? {}
      const row = { ...start, ...mergePatch(start, values) }
      checkLayerAssets(db, values)
      insertLayerRow(ctx, row)
      bumpVariantRev(ctx, input.variantId, deps.now().toISOString())
      const call = { name: 'layer.delete', input: { projectId: input.projectId, layerId: id } }
      return {
        data: { layerId: id },
        log: { variantId: input.variantId },
        inverse: { scope: `variant:${input.variantId}`, call },
      }
    },
  })
}

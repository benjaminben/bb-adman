// layer.restore (spec/editor-commands.md): the inverse of layer.delete, and nothing else. A
// system command no window may send. Puts the row back with its own ID, key and every stored
// value, then sets z from the order. Bumps variant.rev and no layer counter.
import type { CoreDeps } from '@/main/core-deps'
import { defineCommand } from '@/main/commands/types'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import { insertLayerRow } from '@/main/commands/campaign/layer-row'
import { AppError } from '@/shared/schemas/result'
import { layerRestoreInput } from '@/shared/schemas/commands/layer'
import { BAD_ORDER, readOrder, sameLayers, writeOrder } from './reorder'

export function layerRestore(deps: CoreDeps) {
  return defineCommand({
    name: 'layer.restore',
    internal: true,
    input: layerRestoreInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const db = ctx.project.db
      const { layer, order } = input
      const variant = db.prepare('SELECT id FROM variant WHERE id = ?').get(layer.variantId)
      if (!variant) throw new AppError('NOT_FOUND', 'That variant was not found.')
      // An ID is unique across the file, so an ID anywhere is refused, not only in the variant.
      const there = db
        .prepare('SELECT 1 FROM layer WHERE id = ? OR (variant_id = ? AND key = ?)')
        .get(layer.id, layer.variantId, layer.key)
      if (there) {
        throw new AppError('RULE_VIOLATION', 'That layer is already there.', {
          reason: 'layer_exists',
        })
      }
      const after = [...readOrder(db, layer.variantId), layer.id]
      if (layer.type === 'background' || !sameLayers(order, after)) {
        throw new AppError('INVALID_INPUT', BAD_ORDER)
      }
      insertLayerRow(ctx, layer)
      writeOrder(ctx, order)
      bumpVariantRev(ctx, layer.variantId, deps.now().toISOString())
      const call = {
        name: 'layer.delete',
        input: { projectId: input.projectId, layerId: layer.id },
      }
      return {
        data: { layerId: layer.id },
        log: { variantId: layer.variantId },
        inverse: { scope: `variant:${layer.variantId}`, call },
      }
    },
  })
}

// layer.delete (spec/editor-commands.md; FR-092, FR-197): removes a layer and closes the gap
// in z. The background is refused. The inverse is layer.restore with the whole row and the
// order as it was, so undo brings back every stored value. A job naming the layer is left.
import type { CoreDeps } from '@/main/core-deps'
import { defineCommand } from '@/main/commands/types'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import { readWireRow } from '@/main/db/rows'
import { AppError } from '@/shared/schemas/result'
import { layerDeleteInput } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { backgroundLayer, readOrder, writeOrder } from './reorder'

export function layerDelete(deps: CoreDeps) {
  return defineCommand({
    name: 'layer.delete',
    input: layerDeleteInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const db = ctx.project.db
      const row = readWireRow(db, 'layer', { id: input.layerId }) as LayerRow | null
      if (!row) throw new AppError('NOT_FOUND', 'That layer was not found.')
      if (row.type === 'background') throw backgroundLayer()
      const order = readOrder(db, row.variantId)
      db.prepare('DELETE FROM layer WHERE id = ?').run(row.id)
      ctx.changes.touch('layer', { id: row.id })
      writeOrder(
        ctx,
        order.filter((id) => id !== row.id),
      )
      bumpVariantRev(ctx, row.variantId, deps.now().toISOString())
      const call = {
        name: 'layer.restore',
        input: { projectId: input.projectId, layer: row, order },
      }
      return {
        data: { layerId: row.id },
        log: { variantId: row.variantId },
        inverse: { scope: `variant:${row.variantId}`, call },
      }
    },
  })
}

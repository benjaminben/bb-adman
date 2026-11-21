// layer.reportOverflow (spec/editor-commands.md; FR-098): the editor window writes whether a
// text layer's text runs out of its box. A report measured on an older drawing (another
// variant.rev) never wins. Bumps no rev and no counter, and is not undoable.
import { defineCommand } from '@/main/commands/types'
import { AppError } from '@/shared/schemas/result'
import { layerReportOverflowInput } from '@/shared/schemas/commands/layer'

type Stored = { type: string; overflow: number; variantId: string; rev: number }

export function layerReportOverflow() {
  return defineCommand({
    name: 'layer.reportOverflow',
    input: layerReportOverflowInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const db = ctx.project.db
      const row = db
        .prepare(
          `SELECT layer.type, layer.overflow, layer.variant_id AS variantId, variant.rev
           FROM layer JOIN variant ON variant.id = layer.variant_id WHERE layer.id = ?`,
        )
        .get(input.layerId) as Stored | undefined
      if (!row) throw new AppError('NOT_FOUND', 'That layer was not found.')
      if (row.type !== 'text') throw new AppError('INVALID_INPUT', 'Only a text layer has text.')
      const log = { variantId: row.variantId }
      if (row.rev !== input.variantRev || (row.overflow === 1) === input.overflow) {
        return { data: { applied: false }, log }
      }
      db.prepare('UPDATE layer SET overflow = ? WHERE id = ?').run(
        input.overflow ? 1 : 0,
        input.layerId,
      )
      ctx.changes.touch('layer', { id: input.layerId })
      return { data: { applied: true }, log }
    },
  })
}

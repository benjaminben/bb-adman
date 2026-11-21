// variant.update (spec/editor-commands.md; FR-070): the title in Phase 3. Undoable on the
// variant's list with the old title. The stored title writes nothing and adds no undo entry.
import type { CoreDeps } from '@/main/core-deps'
import { defineCommand } from '@/main/commands/types'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import { AppError } from '@/shared/schemas/result'
import { variantUpdateInput } from '@/shared/schemas/commands/variant'

export function variantUpdate(deps: CoreDeps) {
  return defineCommand({
    name: 'variant.update',
    input: variantUpdateInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const db = ctx.project.db
      const row = db.prepare('SELECT title FROM variant WHERE id = ?').get(input.variantId) as
        { title: string } | undefined
      if (!row) throw new AppError('NOT_FOUND', 'That variant was not found.')
      const result = { data: { variantId: input.variantId }, log: { variantId: input.variantId } }
      if (row.title === input.title) return result
      db.prepare('UPDATE variant SET title = ? WHERE id = ?').run(input.title, input.variantId)
      bumpVariantRev(ctx, input.variantId, deps.now().toISOString())
      const call = {
        name: 'variant.update',
        input: { projectId: input.projectId, variantId: input.variantId, title: row.title },
      }
      return { ...result, inverse: { scope: `variant:${input.variantId}`, call } }
    },
  })
}

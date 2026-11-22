// variant.update (spec/editor-commands.md; FR-070, FR-120): the title (Phase 3) and durationMs
// (P7-10). A duration on a variant that is not its direction's master also sets
// duration_overridden. Undoable on the variant's list with the old values, the old flag
// included. Values equal to what is stored write nothing and add no undo entry.
import type Database from 'better-sqlite3'
import type { CoreDeps } from '@/main/core-deps'
import { defineCommand } from '@/main/commands/types'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import { AppError } from '@/shared/schemas/result'
import { variantUpdateInput, type VariantUpdateInput } from '@/shared/schemas/commands/variant'

type Stored = { title: string; durationMs: number; overridden: boolean; master: boolean }

function readStored(db: Database.Database, variantId: string): Stored | null {
  const row = db
    .prepare(
      `SELECT v.title, v.duration_ms AS durationMs, v.duration_overridden AS overridden,
         d.master_variant_id = v.id AS master
       FROM variant v JOIN direction d ON d.id = v.direction_id WHERE v.id = ?`,
    )
    .get(variantId) as
    { title: string; durationMs: number; overridden: number; master: number } | undefined
  if (!row) return null
  return { ...row, overridden: row.overridden === 1, master: row.master === 1 }
}

// The values after the change.
function changed(stored: Stored, input: VariantUpdateInput) {
  const title = input.title ?? stored.title
  const durationMs = input.durationMs ?? stored.durationMs
  const moved = durationMs !== stored.durationMs
  const overridden =
    input.durationOverridden ?? (moved && !stored.master ? true : stored.overridden)
  return { title, durationMs, overridden }
}

export function variantUpdate(deps: CoreDeps) {
  return defineCommand({
    name: 'variant.update',
    input: variantUpdateInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      // P7-10b: the undo-only flag comes only from a replayed inverse, never from an agent.
      if (input.durationOverridden !== undefined && (ctx.actor === 'agent' || !ctx.replay)) {
        throw new AppError('INVALID_INPUT', 'Only an undo or redo sets the duration flag.')
      }
      const db = ctx.project.db
      const stored = readStored(db, input.variantId)
      if (!stored) throw new AppError('NOT_FOUND', 'That variant was not found.')
      const result = { data: { variantId: input.variantId }, log: { variantId: input.variantId } }
      const next = changed(stored, input)
      const same =
        next.title === stored.title &&
        next.durationMs === stored.durationMs &&
        next.overridden === stored.overridden
      if (same) return result
      db.prepare(
        'UPDATE variant SET title = ?, duration_ms = ?, duration_overridden = ? WHERE id = ?',
      ).run(next.title, next.durationMs, next.overridden ? 1 : 0, input.variantId)
      bumpVariantRev(ctx, input.variantId, deps.now().toISOString())
      const back = { projectId: input.projectId, variantId: input.variantId }
      const old =
        input.durationMs === undefined
          ? { title: stored.title }
          : {
              ...(input.title === undefined ? {} : { title: stored.title }),
              durationMs: stored.durationMs,
              durationOverridden: stored.overridden,
            }
      const call = { name: 'variant.update', input: { ...back, ...old } }
      return { ...result, inverse: { scope: `variant:${input.variantId}`, call } }
    },
  })
}

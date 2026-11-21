// layer.reorder (spec/editor-commands.md; FR-092): sets z of every non-background layer to
// 1, 2, 3 ... in the given order; the background keeps z = 0. Also holds the order helpers
// layer.delete and layer.restore share.
import type Database from 'better-sqlite3'
import type { CoreDeps } from '@/main/core-deps'
import { defineCommand, type ProjectContext } from '@/main/commands/types'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import { AppError } from '@/shared/schemas/result'
import { layerReorderInput } from '@/shared/schemas/commands/layer'

export const BAD_ORDER = 'List every layer of the variant once, without the background.'

export const backgroundLayer = () =>
  new AppError(
    'RULE_VIOLATION',
    'The background layer stays at the bottom and cannot be deleted.',
    {
      reason: 'background_layer',
    },
  )

// The IDs of the variant's non-background layers, lowest first.
export function readOrder(db: Database.Database, variantId: string): string[] {
  const rows = db
    .prepare(`SELECT id FROM layer WHERE variant_id = ? AND type != 'background' ORDER BY z, id`)
    .all(variantId) as Array<{ id: string }>
  return rows.map((row) => row.id)
}

// True when `given` names each of `stored` exactly once and nothing else: as many names as
// stored layers, and every stored layer among them, leaves no room for a repeat.
export function sameLayers(given: string[], stored: string[]): boolean {
  const names = new Set(given)
  return given.length === stored.length && stored.every((id) => names.has(id))
}

// Sets z to 1, 2, 3 ... in the given order and names each layer whose z changed. Answers
// whether any z changed.
export function writeOrder(ctx: ProjectContext, ids: string[]): boolean {
  const update = ctx.project.db.prepare('UPDATE layer SET z = ? WHERE id = ? AND z != ?')
  let changed = false
  ids.forEach((id, index) => {
    if (update.run(index + 1, id, index + 1).changes === 0) return
    ctx.changes.touch('layer', { id })
    changed = true
  })
  return changed
}

export function layerReorder(deps: CoreDeps) {
  return defineCommand({
    name: 'layer.reorder',
    input: layerReorderInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const db = ctx.project.db
      const { variantId, layerIds } = input
      const variant = db.prepare('SELECT id FROM variant WHERE id = ?').get(variantId)
      if (!variant) throw new AppError('NOT_FOUND', 'That variant was not found.')
      const background = db
        .prepare(`SELECT id FROM layer WHERE variant_id = ? AND type = 'background'`)
        .all(variantId) as Array<{ id: string }>
      if (background.some((row) => layerIds.includes(row.id))) throw backgroundLayer()
      const stored = readOrder(db, variantId)
      if (!sameLayers(layerIds, stored)) throw new AppError('INVALID_INPUT', BAD_ORDER)
      const result = { data: { variantId }, log: { variantId } }
      if (!writeOrder(ctx, layerIds)) return result
      bumpVariantRev(ctx, variantId, deps.now().toISOString())
      const call = {
        name: 'layer.reorder',
        input: { projectId: input.projectId, variantId, layerIds: stored },
      }
      return { ...result, inverse: { scope: `variant:${variantId}`, call } }
    },
  })
}

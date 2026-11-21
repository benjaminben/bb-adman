// Writes one layer for layer.update, layer.updateMany, layer.revert and layer.clearOverride
// (spec/editor-commands.md, "Layer counters"): the changed columns, one counter per changed
// group and, when given, the override list. Shared so every command writes the same way. Also
// the override rule of an edit (spec/links-and-sync.md, "Overrides"; A-135, A-136).
import type Database from 'better-sqlite3'
import type { ProjectContext } from '@/main/commands/types'
import { readWireRow, storedJson } from '@/main/db/rows'
import { masterOf, type MasterOf } from '@/main/links/master-of'
import { addPaths, inheritedPaths, pathsOfPatch } from '@/shared/links/override-paths'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import type { MergedValues, PatchKey } from './merge-patch'

const GROUPS = ['copy', 'style', 'geometry', 'source', 'timing', 'animation'] as const
const JSON_KEYS = new Set<string>(['style', 'geometry', 'source', 'timing', 'animation'])

function stored(key: PatchKey, value: unknown): unknown {
  if (typeof value === 'boolean') return value ? 1 : 0
  return JSON_KEYS.has(key) ? storedJson('layer', key, value) : value
}

// The column names are the patch keys, one word each, from a fixed list.
export function writeLayer(
  ctx: ProjectContext,
  row: LayerRow,
  merged: MergedValues,
  keys: PatchKey[],
  overrides?: string[],
) {
  const revs = { ...row.revs }
  for (const group of GROUPS) if (keys.includes(group)) revs[group] += 1
  const list = overrides ? [storedJson('layer', 'overrides', overrides)] : []
  const columns = [
    ...keys.map((key) => `"${key}" = ?`),
    ...(overrides ? ['overrides = ?'] : []),
    'revs = ?',
  ].join(', ')
  const values = [
    ...keys.map((key) => stored(key, merged[key])),
    ...list,
    storedJson('layer', 'revs', revs),
  ]
  ctx.project.db.prepare(`UPDATE layer SET ${columns} WHERE id = ?`).run(...values, row.id)
  ctx.changes.touch('layer', { id: row.id })
}

export type FollowedMaster = { variant: VariantRow; master: MasterOf }

// The layer's variant and its direction's master, when the layer follows that master: it is
// linked and its variant is not the master. Null otherwise.
export function followedMaster(db: Database.Database, row: LayerRow): FollowedMaster | null {
  if (!row.linked) return null
  const variant = readWireRow(db, 'variant', { id: row.variantId }) as VariantRow | null
  const master = variant ? masterOf(db, variant.directionId) : null
  if (!variant || !master || master.variant.id === variant.id) return null
  return { variant, master }
}

// The override list after an edit whose inverse patch is `inverse` (A-135): every changed path
// that follows for this variant, added once. Null when the list does not change.
export function overridesAfter(
  db: Database.Database,
  row: LayerRow,
  inverse: Record<string, unknown>,
): string[] | null {
  const link = followedMaster(db, row)
  if (!link) return null
  const paths = inheritedPaths(pathsOfPatch(inverse), link.master.variant, link.variant)
  const next = addPaths(row.overrides, paths)
  return next.length === row.overrides.length ? null : next
}

export type RevertItem = { layerId: string; patch: Record<string, unknown>; overrides: string[] }

// The inverse of a command that changed an override list (A-136): layer.revert on the
// variant's list, with the values and lists before the command ran.
export function revertInverse(projectId: string, variantId: string, layers: RevertItem[]) {
  const call = { name: 'layer.revert', input: { projectId, variantId, layers } }
  return { scope: `variant:${variantId}`, call }
}

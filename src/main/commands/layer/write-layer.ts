// Writes one layer for layer.update and layer.updateMany (spec/editor-commands.md, "Layer
// counters"): the changed columns and one counter per changed group. Shared so both commands
// write the same way. A copy edit also leaves a translation proposed (A-161), on this row only.
import type { ProjectContext } from '@/main/commands/types'
import { storedJson } from '@/main/db/rows'
import { translationAfterCopyEdit } from '@/main/translation/copy-edit'
import type { LayerRow } from '@/shared/schemas/rows/layer'
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
) {
  const revs = { ...row.revs }
  for (const group of GROUPS) if (keys.includes(group)) revs[group] += 1
  const columns = [...keys.map((key) => `"${key}" = ?`), 'revs = ?']
  const values = [...keys.map((key) => stored(key, merged[key])), storedJson('layer', 'revs', revs)]
  const translation = keys.includes('copy') ? translationAfterCopyEdit(row, ctx.actor) : null
  if (translation) {
    columns.push('translation_status = ?', 'translation_source = ?')
    values.push(translation.translationStatus, translation.translationSource)
  }
  ctx.project.db
    .prepare(`UPDATE layer SET ${columns.join(', ')} WHERE id = ?`)
    .run(...values, row.id)
  ctx.changes.touch('layer', { id: row.id })
}

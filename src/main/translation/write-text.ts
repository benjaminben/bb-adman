// The one place translation text is written (spec/phases/phase-06.md, design addition 2):
// copy, status, source, synced_revs.copy and the copy counter, then variant.rev once per
// variant written. Used by translation.set, approve and restore, and by translation.write.
import type { ProjectContext } from '@/main/commands/types'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import { storedJson } from '@/main/db/rows'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { TranslationRestoreItem } from '@/shared/schemas/commands/translation'

// What a translation command writes to one layer: a translation.restore item.
export type TextValues = TranslationRestoreItem

export type TextWrite = { row: LayerRow; next: TextValues }

// The values stored on a layer now, as a restore item.
export function textValuesOf(row: LayerRow): TextValues {
  return {
    layerId: row.id,
    copy: row.copy,
    translationStatus: row.translationStatus,
    translationSource: row.translationSource,
    syncedCopyRev: row.syncedRevs.copy,
  }
}

export function sameText(a: TextValues, b: TextValues): boolean {
  return (
    a.copy === b.copy &&
    a.translationStatus === b.translationStatus &&
    a.translationSource === b.translationSource &&
    a.syncedCopyRev === b.syncedCopyRev
  )
}

// Writes each layer's new values. The copy counter goes up only when the copy changes, as
// every other group's counter does (spec/data-rules.md, "Links").
export function writeTexts(ctx: ProjectContext, writes: TextWrite[], now: string): void {
  const update = ctx.project.db.prepare(
    `UPDATE layer SET copy = ?, translation_status = ?, translation_source = ?, revs = ?,
       synced_revs = ? WHERE id = ?`,
  )
  const variants = new Set<string>()
  for (const { row, next } of writes) {
    const revs = { ...row.revs, copy: row.revs.copy + (next.copy === row.copy ? 0 : 1) }
    const synced = { ...row.syncedRevs, copy: next.syncedCopyRev }
    update.run(
      next.copy,
      next.translationStatus,
      next.translationSource,
      storedJson('layer', 'revs', revs),
      storedJson('layer', 'syncedRevs', synced),
      row.id,
    )
    ctx.changes.touch('layer', { id: row.id })
    variants.add(row.variantId)
  }
  for (const variantId of variants) bumpVariantRev(ctx, variantId, now)
}

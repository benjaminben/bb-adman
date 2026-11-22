// The grid test of variant.setFormat (spec/data-rules.md, "Changing a variant's format"),
// both directions: before any write, a change is refused when the direction already has
// another variant at the same size and language in the target format. The variant_grid
// unique index stays as it is; this check answers first with the table's sentence.
import type Database from 'better-sqlite3'
import { formatChange, type Format } from '@/shared/config/format-changes'
import { AppError } from '@/shared/schemas/result'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { videoRefusal } from '@/shared/video/messages'

export function gridTest(db: Database.Database, variant: VariantRow, to: Format): void {
  const change = formatChange(variant.format, to)
  if (!change) throw new AppError('INVALID_INPUT', 'That format change is not allowed.')
  const taken = db
    .prepare(
      `SELECT 1 FROM variant WHERE direction_id = ? AND size_label = ? AND language = ?
       AND format = ? AND id <> ?`,
    )
    .get(variant.directionId, variant.sizeLabel, variant.language, to, variant.id)
  if (taken) throw videoRefusal(change.takenReason)
}

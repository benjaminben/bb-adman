// A-161 (spec/phases/phase-06.md, design addition 2): a copy edit through any route other than
// translation.set leaves a translation proposed, from whoever sent it, so an edited text is
// never approved [REQ: FR-101]. A layer that is not a translation (null status) stays so.
import type { Actor } from '@/shared/schemas/events'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { TranslationFields } from '@/shared/translation/initial'

export function translationAfterCopyEdit(row: LayerRow, actor: Actor): TranslationFields | null {
  if (row.translationStatus === null) return null
  return { translationStatus: 'proposed', translationSource: actor }
}

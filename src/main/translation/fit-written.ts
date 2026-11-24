// The fit when a translation run first fills a layer (spec/make-variants.md, "When a
// translation arrives", "What a fitted size is to the link"; MV-5). For each layer
// translation.write wrote whose status was `missing`, on a variant that is not its direction's
// master, the font size is fitted to the new words (fitTranslatedText): only ever smaller. The
// style, revs.style + 1 and the override paths are written in the command's transaction, after
// the words. variant.rev was bumped once by the words' write, so it is not bumped again.
import type { ProjectContext } from '@/main/commands/types'
import { readWireRow, storedJson } from '@/main/db/rows'
import { masterOf } from '@/main/links/master-of'
import type { TextWrite } from '@/main/translation/write-text'
import { fitTranslatedText } from '@/shared/links/fit-text'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'

export function fitWrittenTexts(ctx: ProjectContext, writes: TextWrite[]): void {
  const db = ctx.project.db
  const update = db.prepare('UPDATE layer SET style = ?, overrides = ?, revs = ? WHERE id = ?')
  for (const { row: before, next } of writes) {
    if (before.translationStatus !== 'missing') continue
    const row = readWireRow(db, 'layer', { id: before.id }) as LayerRow | null
    const variant = readWireRow(db, 'variant', { id: before.variantId }) as VariantRow | null
    if (!row || !variant) continue
    const master = masterOf(db, variant.directionId)
    if (!master || master.variant.id === variant.id) continue
    const masterLayer = row.linked ? (master.layers.find((l) => l.key === row.key) ?? null) : null
    const size = { width: variant.width, height: variant.height }
    const fit = fitTranslatedText(row, next.copy, size, masterLayer)
    if (!fit) continue
    const revs = { ...row.revs, style: row.revs.style + 1 }
    update.run(
      storedJson('layer', 'style', fit.style),
      storedJson('layer', 'overrides', fit.overrides),
      storedJson('layer', 'revs', revs),
      row.id,
    )
    ctx.changes.touch('layer', { id: row.id })
  }
}

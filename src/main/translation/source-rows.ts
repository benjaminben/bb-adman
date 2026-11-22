// R3-3: the reply of translation.sources, read from the project file. A read only; it never
// writes. The rows are the text layers of every post in the primary language; out of date are
// the translated text layers whose master copy is ahead of what they last synced, by the same
// rule the Variants tab's "Out of date" mark uses (spec/links-and-sync.md, "Out of date").
import type Database from 'better-sqlite3'
import { readWireRows } from '@/main/db/rows'
import { directionsOf } from '@/main/queries/campaign-reads'
import { layersOf } from '@/main/queries/variant-reads'
import { masterOf } from '@/main/links/master-of'
import { followRule, type Group } from '@/shared/links/follow-rules'
import { staleGroups } from '@/shared/links/out-of-date'
import type { SourceRow, TranslationSources } from '@/shared/schemas/queries/translation'
import type { CampaignRow } from '@/shared/schemas/rows/campaign'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'

const sourceRow =
  (v: VariantRow) =>
  (l: LayerRow): SourceRow => ({
  directionId: v.directionId,
  variantId: v.id,
  title: v.title,
  sizeLabel: v.sizeLabel,
  language: v.language,
  layerId: l.id,
  layerName: l.name,
  text: l.copy ?? '',
  copyRev: l.revs.copy,
})

// The copy-stale translated text layers of one direction's variants.
function staleIn(db: Database.Database, directionId: string, variants: VariantRow[]): string[] {
  const master = masterOf(db, directionId)
  if (!master) return []
  const byKey = new Map(master.layers.map((l) => [l.key, l]))
  return variants.flatMap((v) => {
    const rule = (g: Group) => followRule(g, master.variant, v)
    return layersOf(db, v.id)
      .filter((l) => l.type === 'text')
      .filter((l) => {
        const from = byKey.get(l.key)
        return from !== undefined && staleGroups(from, l, rule).includes('copy')
      })
      .map((l) => l.id)
  })
}

// Rows in direction order, then by variant ID and layer z; the window orders them as it shows them.
export function translationSources(
  db: Database.Database,
  campaign: CampaignRow,
): TranslationSources {
  const variants = readWireRows(db, 'variant') as VariantRow[]
  const rows: SourceRow[] = []
  const outOfDate: string[] = []
  for (const d of directionsOf(db, campaign.id)) {
    const mine = variants
      .filter((v) => v.directionId === d.id)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const primary = mine.filter((v) => v.language === campaign.primaryLanguage)
    for (const v of primary) {
      rows.push(...layersOf(db, v.id).filter((l) => l.type === 'text').map(sourceRow(v)))
    }
    const others = mine.filter((v) => v.language !== campaign.primaryLanguage)
    outOfDate.push(...staleIn(db, d.id, others))
  }
  return { rows, outOfDate }
}

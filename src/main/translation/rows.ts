// The rows and job states of translation.forCampaign (spec/phases/phase-06.md, design
// addition 1), read from the project file. A read only; it never writes.
import type Database from 'better-sqlite3'
import { readWireRows } from '@/main/db/rows'
import { directionsOf } from '@/main/queries/campaign-reads'
import { layersOf } from '@/main/queries/variant-reads'
import { masterOf } from '@/main/links/master-of'
import { translationJobRequest } from '@/shared/schemas/jobs/translation'
import type { TranslationJobState, TranslationRow } from '@/shared/schemas/queries/translation'
import type { CampaignRow } from '@/shared/schemas/rows/campaign'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

const fontOf = (l: LayerRow) => ('fontAssetId' in l.style ? (l.style.fontAssetId ?? null) : null)

// The master's copy per key, from its text layers.
function sourceTexts(db: Database.Database, directionId: string): Map<string, string> {
  const layers = masterOf(db, directionId)?.layers ?? []
  return new Map(layers.filter((l) => l.type === 'text').map((l) => [l.key, l.copy ?? '']))
}

function rowsOf(v: VariantRow, layers: LayerRow[], sources: Map<string, string>) {
  return layers
    .filter((l) => l.type === 'text')
    .map((l): TranslationRow => ({
      directionId: v.directionId,
      variantId: v.id,
      title: v.title,
      sizeLabel: v.sizeLabel,
      language: v.language,
      layerId: l.id,
      layerKey: l.key,
      layerName: l.name,
      sourceText: sources.get(l.key) ?? null,
      text: l.copy ?? '',
      status: l.translationStatus,
      source: l.translationSource,
      fontAssetId: fontOf(l),
    }))
}

// One row per text layer of every post not in the primary language: by direction sort, then
// language, then size label, then layer z (layersOf's order).
export function translationRows(db: Database.Database, campaign: CampaignRow): TranslationRow[] {
  const variants = (readWireRows(db, 'variant') as VariantRow[]).filter(
    (v) => v.language !== campaign.primaryLanguage,
  )
  return directionsOf(db, campaign.id).flatMap((d) => {
    const sources = sourceTexts(db, d.id)
    return variants
      .filter((v) => v.directionId === d.id)
      .sort(
        (a, b) =>
          byText(a.language, b.language) || byText(a.sizeLabel, b.sizeLabel) || byText(a.id, b.id),
      )
      .flatMap((v) => rowsOf(v, layersOf(db, v.id), sources))
  })
}

// The newest translation job per direction and language (by created_at, then ID), in direction
// order, then language. A job whose request cannot be read, or whose direction is not one of
// the campaign's, is left out.
export function translationJobStates(
  db: Database.Database,
  campaignId: string,
): TranslationJobState[] {
  const order = new Map(directionsOf(db, campaignId).map((d, i) => [d.id, i]))
  const newest = new Map<string, TranslationJobState & { createdAt: string }>()
  for (const job of readWireRows(db, 'job') as JobRow[]) {
    if (job.kind !== 'translation' || job.campaignId !== campaignId) continue
    const request = translationJobRequest.safeParse(job.request)
    if (!request.success || !order.has(request.data.directionId)) continue
    const { directionId, to } = request.data
    const key = JSON.stringify([directionId, to])
    const held = newest.get(key)
    if (held && (byText(job.createdAt, held.createdAt) || byText(job.id, held.jobId)) < 0) continue
    const { id: jobId, status, errorKind, createdAt } = job
    newest.set(key, { directionId, language: to, jobId, status, errorKind, createdAt })
  }
  return [...newest.values()]
    .map(({ createdAt: _, ...state }): TranslationJobState => state)
    .sort(
      (a, b) =>
        (order.get(a.directionId) ?? 0) - (order.get(b.directionId) ?? 0) ||
        byText(a.language, b.language),
    )
}

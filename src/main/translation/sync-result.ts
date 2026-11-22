// Translation in the sync review (spec/phases/phase-06.md, section 7; P6-16). A `sync` job
// writes nothing: its request records each layer's copy counter when it was queued, and its
// result holds the cleaned texts. latestSyncTranslation gives the newest such job of one
// direction and language; a text from it is used only when that job succeeded against the
// master's copy counter now and the layer's own counter has not moved since (A-155's guard),
// so an older or failed job, or a text typed over since, is never replaced by it.
import type Database from 'better-sqlite3'
import { readWireRow, readWireRows } from '@/main/db/rows'
import type { JobStatus } from '@/shared/config/job-kinds'
import type { SyncPlanInput, VariantWrites } from '@/shared/links/sync-plan'
import {
  translationJobRequest,
  translationJobResult,
  type TranslationJobRequest,
} from '@/shared/schemas/jobs/translation'
import type { SyncPreview } from '@/shared/schemas/queries/sync'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { TranslationGroup, TranslationPlan } from './targets'

export type SyncTranslation = {
  jobId: string
  status: JobStatus
  request: TranslationJobRequest
  texts: Map<string, string> // key to cleaned text; empty unless the job succeeded
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

// The newest `sync` translation job (by created_at, then ID) of the direction's campaign for
// this direction and language, or null.
export function latestSyncTranslation(
  db: Database.Database,
  directionId: string,
  language: string,
): SyncTranslation | null {
  const direction = readWireRow(db, 'direction', { id: directionId }) as DirectionRow | null
  if (!direction) return null
  let newest: { job: JobRow; request: TranslationJobRequest } | null = null
  for (const job of readWireRows(db, 'job') as JobRow[]) {
    if (job.kind !== 'translation' || job.campaignId !== direction.campaignId) continue
    const parsed = translationJobRequest.safeParse(job.request)
    if (!parsed.success) continue
    const request = parsed.data
    if (request.mode !== 'sync' || request.directionId !== directionId) continue
    if (request.to !== language) continue
    const held = newest?.job
    if (held && (byText(job.createdAt, held.createdAt) || byText(job.id, held.id)) < 0) continue
    newest = { job, request }
  }
  if (!newest) return null
  const { job, request } = newest
  const result = job.status === 'succeeded' ? translationJobResult.safeParse(job.result) : null
  const items = result?.success ? result.data.items : []
  return {
    jobId: job.id,
    status: job.status,
    request,
    texts: new Map(items.map((i) => [i.key, i.text])),
  }
}

// The AI text for one layer from that job, or null when it may not be used.
export function syncTextFor(
  found: SyncTranslation | null,
  layer: LayerRow,
  master: LayerRow | undefined,
): string | null {
  if (found?.status !== 'succeeded' || !master || master.key !== layer.key) return null
  const item = found.request.items.find((i) => i.key === layer.key)
  if (item?.masterCopyRev !== master.revs.copy) return null
  const target = found.request.targets.find((t) => t.layerId === layer.id)
  if (target?.key !== layer.key || target.copyRev !== layer.revs.copy) return null
  return found.texts.get(layer.key) ?? null
}

// The layers a sync job is for, with their copy counters now: the linked text layers of the
// group's variants (never the master) whose key is among the job's items and whose copy is not
// the variant's own.
export function withSyncTargets(
  db: Database.Database,
  plan: TranslationPlan,
  group: TranslationGroup,
): TranslationPlan {
  const direction = readWireRow(db, 'direction', { id: group.directionId }) as DirectionRow | null
  const keys = new Set(plan.request.items.map((i) => i.key))
  const layers = db.prepare(
    `SELECT id FROM layer WHERE variant_id = ? AND type = 'text' AND linked = 1 ORDER BY z, id`,
  )
  const targets = group.variantIds
    .filter((id) => id !== direction?.masterVariantId)
    .flatMap((variantId) => layers.all(variantId) as Array<{ id: string }>)
    .map(({ id }) => readWireRow(db, 'layer', { id }) as LayerRow | null)
    .filter((l): l is LayerRow => !!l && keys.has(l.key) && !l.overrides.includes('copy'))
    .map((l) => ({ layerId: l.id, key: l.key, copyRev: l.revs.copy }))
  return { ...plan, request: { ...plan.request, targets } }
}

type Found = (language: string) => SyncTranslation | null

// One read of the newest job per language of this direction.
function finder(db: Database.Database, directionId: string): Found {
  const cache = new Map<string, SyncTranslation | null>()
  return (language) => {
    if (!cache.has(language)) cache.set(language, latestSyncTranslation(db, directionId, language))
    return cache.get(language) ?? null
  }
}

// sync.preview: each translated copy change gets the job's text, `proposed`, when it may be
// used; otherwise it keeps the plan's `failed` with the layer's current text.
export function withSyncTranslations(
  db: Database.Database,
  directionId: string,
  plan: SyncPlanInput,
  previews: SyncPreview[],
): SyncPreview[] {
  const found = finder(db, directionId)
  const masters = new Map(plan.master.layers.map((l) => [l.key, l]))
  const variants = new Map(plan.variants.map((v) => [v.row.id, v]))
  return previews.map((preview) => {
    const variant = variants.get(preview.variantId)
    const changes = preview.changes.map((change) => {
      const layer = variant?.layers.find((l) => l.key === change.layerKey)
      if (!change.proposedTranslation || !variant || !layer) return change
      const text = syncTextFor(found(variant.row.language), layer, masters.get(layer.key))
      return text === null
        ? change
        : { ...change, proposedTranslation: { text, status: 'proposed' as const } }
    })
    return { ...preview, changes }
  })
}

// sync.apply: an accepted translated copy change writes the job's text, `proposed`, source
// `ai`, when it may be used; otherwise the plan's write stands (text kept, `missing`).
export function withSyncTexts(
  db: Database.Database,
  directionId: string,
  plan: SyncPlanInput,
  writes: VariantWrites[],
): VariantWrites[] {
  const found = finder(db, directionId)
  const masters = new Map(plan.master.layers.map((l) => [l.key, l]))
  const variants = new Map(plan.variants.map((v) => [v.row.id, v]))
  return writes.map((w) => {
    const variant = variants.get(w.variantId)
    const updates = w.updates.map((u) => {
      const layer = variant?.layers.find((l) => l.id === u.layerId)
      if (u.patch.translationStatus !== 'missing' || !variant || !layer) return u
      const text = syncTextFor(found(variant.row.language), layer, masters.get(layer.key))
      if (text === null) return u
      const patch = { ...u.patch, copy: text, translationStatus: 'proposed' as const }
      return { ...u, patch: { ...patch, translationSource: 'ai' as const } }
    })
    return { ...w, updates }
  })
}

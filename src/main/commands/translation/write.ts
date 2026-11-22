// translation.write (spec/phases/phase-06.md, design addition 2; A-155). System command: the
// translation job sends its cleaned answer (A-168). Deny and internal. The layers come from the
// job's own request, read from this project's file, never from the input; a layer is written
// only when it is a text layer of the job's campaign, direction and language. A layer changed
// or approved since the job was queued is left alone. Writes `proposed`, source `ai`, never
// `approved`. Not undoable, as asset.addGenerated is not.
import type Database from 'better-sqlite3'
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { readWireRow } from '@/main/db/rows'
import { sameText, textValuesOf, writeTexts, type TextWrite } from '@/main/translation/write-text'
import {
  translationWriteInput,
  type TranslationWriteReply,
} from '@/shared/schemas/commands/translation'
import {
  translationJobRequest,
  type TranslationJobRequest,
} from '@/shared/schemas/jobs/translation'
import type { CampaignRow } from '@/shared/schemas/rows/campaign'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { AppError } from '@/shared/schemas/result'

type Job = { row: JobRow; request: TranslationJobRequest }

const noRun = () => new AppError('NOT_FOUND', 'That translation run was not found.')

// The running write-mode translation job of this project, or a refusal.
function runningJob(db: Database.Database, jobId: string): Job {
  const row = readWireRow(db, 'job', { id: jobId }) as JobRow | null
  if (row?.kind !== 'translation' || row.status !== 'running') throw noRun()
  const request = translationJobRequest.safeParse(row.request)
  if (!request.success || request.data.mode !== 'write') throw noRun()
  return { row, request: request.data }
}

// A text layer of the job's campaign, direction and language that is still a translation the
// AI may replace (A-155, A-156). Never the direction's master, never a post in the campaign's
// main language (P6-16, from the Phase 5 review).
function mayReplace(db: Database.Database, layer: LayerRow, job: Job): boolean {
  const variant = readWireRow(db, 'variant', { id: layer.variantId }) as VariantRow | null
  const direction = variant
    ? (readWireRow(db, 'direction', { id: variant.directionId }) as DirectionRow | null)
    : null
  const campaign = direction
    ? (readWireRow(db, 'campaign', { id: direction.campaignId }) as CampaignRow | null)
    : null
  return (
    layer.type === 'text' &&
    variant?.directionId === job.request.directionId &&
    variant.language === job.request.to &&
    direction?.campaignId === job.row.campaignId &&
    direction.masterVariantId !== variant.id &&
    campaign !== null &&
    variant.language !== campaign.primaryLanguage &&
    (layer.translationStatus === 'missing' || layer.translationStatus === 'proposed') &&
    !layer.overrides.includes('copy')
  )
}

function writesFor(db: Database.Database, job: Job, items: Map<string, string>): TextWrite[] {
  const masterRevs = new Map(job.request.items.map((i) => [i.key, i.masterCopyRev]))
  const seen = new Set<string>()
  const writes: TextWrite[] = []
  for (const target of job.request.targets) {
    const text = items.get(target.key)
    const masterRev = masterRevs.get(target.key)
    if (text === undefined || masterRev === undefined || seen.has(target.layerId)) continue
    seen.add(target.layerId)
    const row = readWireRow(db, 'layer', { id: target.layerId }) as LayerRow | null
    if (!row || row.key !== target.key || row.revs.copy !== target.copyRev) continue
    if (!mayReplace(db, row, job)) continue
    const next = {
      layerId: row.id,
      copy: text,
      translationStatus: 'proposed' as const,
      translationSource: 'ai' as const,
      syncedCopyRev: row.linked ? masterRev : row.syncedRevs.copy,
    }
    if (!sameText(textValuesOf(row), next)) writes.push({ row, next })
  }
  return writes
}

export function translationWrite(deps: CoreDeps) {
  return defineCommand({
    name: 'translation.write',
    internal: true,
    input: translationWriteInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const db = ctx.project.db
      const job = runningJob(db, input.jobId)
      const items = new Map(input.items.map((i) => [i.key, i.text]))
      const writes = writesFor(db, job, items)
      if (writes.length > 0) writeTexts(ctx, writes, deps.now().toISOString())
      const data: TranslationWriteReply = { written: writes.length }
      return { data, log: { campaignId: job.row.campaignId ?? undefined } }
    },
  })
}

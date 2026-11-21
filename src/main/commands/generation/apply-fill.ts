// generation.applyFill (spec/links-and-sync.md, "Generative fill"; A-130, A-131, A-141): places
// a finished fill on its targets. Agent policy deny. Everything it writes comes from the
// command's own project file: the job row names the picture, and the targets are worked out
// from the variants now, never from the input. One campaign entry, whose inverse is
// variant.restoreLayers with each target's layers before the fill; the targets' own undo
// lists are cleared.
import type Database from 'better-sqlite3'
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import { writeLayer } from '@/main/commands/layer/write-layer'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import type { CoreDeps } from '@/main/core-deps'
import { readWireRow } from '@/main/db/rows'
import { readLayers } from '@/main/links/snapshot'
import { addPaths } from '@/shared/links/override-paths'
import {
  generationApplyFillInput,
  type GenerationApplyFillReply,
} from '@/shared/schemas/commands/generation'
import {
  generativeFillJobRequest,
  generativeFillJobResult,
} from '@/shared/schemas/jobs/generative-fill'
import { AppError } from '@/shared/schemas/result'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'

type Fill = { variantId: string; sourceAssetId: string; assetId: string }
type Target = { variant: VariantRow; layers: LayerRow[]; background: LayerRow }

const refuse = (reason: string, message: string) =>
  new AppError('RULE_VIOLATION', message, { reason })
const wrongState = () => refuse('job_wrong_state', 'Only a finished fill can be placed.')
const OUTDATED =
  'The background changed after the fill started, so the fill was not placed. It is in the asset library.'

// The job must be a generative_fill of this project that succeeded, with a request and a
// result of the fill's shapes, and its picture must be in this project's asset table.
function finishedFill(db: Database.Database, jobId: string): Fill {
  const job = readWireRow(db, 'job', { id: jobId }) as JobRow | null
  if (!job || job.kind !== 'generative_fill' || job.status !== 'succeeded' || !job.variantId) {
    throw wrongState()
  }
  const request = generativeFillJobRequest.safeParse(job.request)
  const result = generativeFillJobResult.safeParse(job.result)
  const assetId = result.success ? result.data.assetIds[0] : undefined
  if (!request.success || !assetId) throw wrongState()
  if (!db.prepare('SELECT 1 FROM asset WHERE id = ?').get(assetId)) throw wrongState()
  return { variantId: job.variantId, sourceAssetId: request.data.sourceAssetId, assetId }
}

// A-130: the job's variant and every variant of its direction at the same width and height
// whose background is linked, has no source override and still names the source. The master
// is never a target: its layers are not put back by variant.restoreLayers.
function targetsOf(db: Database.Database, fill: Fill): Target[] {
  const own = readWireRow(db, 'variant', { id: fill.variantId }) as VariantRow | null
  if (!own) return []
  const ids = db
    .prepare(
      `SELECT v.id FROM variant v JOIN direction d ON d.id = v.direction_id
       WHERE v.direction_id = ? AND v.width = ? AND v.height = ? AND v.id != d.master_variant_id
       ORDER BY v.id = ? DESC, v.created_at, v.id`,
    )
    .all(own.directionId, own.width, own.height, own.id) as Array<{ id: string }>
  return ids.flatMap(({ id }) => {
    const variant = readWireRow(db, 'variant', { id }) as VariantRow | null
    const layers = readLayers(db, id)
    const background = layers.find((l) => l.type === 'background')
    if (!variant || !background || background.source?.assetId !== fill.sourceAssetId) return []
    const follows = background.linked && !background.overrides.includes('source')
    return id === own.id || follows ? [{ variant, layers, background }] : []
  })
}

export function generationApplyFill(deps: CoreDeps) {
  return defineCommand({
    name: 'generation.applyFill',
    input: generationApplyFillInput,
    projectId: (input) => input.projectId,
    run(ctx, input): HandlerResult<GenerationApplyFillReply> {
      const db = ctx.project.db
      const fill = finishedFill(db, input.jobId)
      const targets = targetsOf(db, fill)
      const first = targets[0]
      if (!first) throw refuse('fill_outdated', OUTDATED)
      const direction = readWireRow(db, 'direction', { id: first.variant.directionId }) as {
        campaignId: string
      } | null
      // A broken file: the runner answers INTERNAL and logs this line, which holds no data.
      if (!direction) throw new Error('generation.applyFill: the variant has no direction row')
      const now = deps.now().toISOString()
      for (const { variant, background } of targets) {
        const geometry = {
          x: 0,
          y: 0,
          width: variant.width,
          height: variant.height,
          rotation: 0,
          crop: null,
        }
        const merged = { source: { assetId: fill.assetId }, geometry }
        const overrides = addPaths(background.overrides, ['source'])
        writeLayer(ctx, background, merged, ['source', 'geometry'], overrides)
        bumpVariantRev(ctx, variant.id, now)
      }
      const variantIds = targets.map((t) => t.variant.id)
      const earlier = targets.map((t) => ({ variantId: t.variant.id, layers: t.layers }))
      const call = {
        name: 'variant.restoreLayers',
        input: { projectId: input.projectId, variants: earlier },
      }
      const campaignId = direction.campaignId
      return {
        data: { variantIds },
        log: { campaignId },
        inverse: { scope: `campaign:${campaignId}`, call },
        clearScopes: variantIds.map((id) => `variant:${id}`),
      }
    },
  })
}

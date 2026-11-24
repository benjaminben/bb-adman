// The files of one "Update gallery" (round-2-approvals-video.md "When a clip is made"): for
// each variant, in campaign.get order, the still is drawn and uploaded when its rev changed,
// and a video variant's clip is made, reused or left out by the table there. Every file this
// run uploads is added to `uploaded` before it is sent, so the caller can remove them all on a
// failure or a stop. Paths come only from picture-paths.ts; no path or signed address reaches
// a log line or an error.
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { plainMessage } from '@/main/providers/messages'
import { ProviderFailure } from '@/main/providers/types'
import { renderFailedMessage } from '@/shared/approvals/messages'
import { clipPath, picturePath } from '@/shared/approvals/picture-paths'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { AppError } from '@/shared/schemas/result'
import { clipBlocked, makeClip, stopIfAsked, type ClipMade, type ClipMissing } from './clip-step'
import type { ApprovalsClient } from './client'
import type { VariantRecord } from './local-store'
import { progressCounter } from './progress-counter'
import type { PictureStore, PublishProgress } from './types'

type Pair = { projectId: string; campaignId: string }

export const PICTURE_SIDE = 1600

export type PublishInput = {
  project: ProjectHandle
  pair: Pair
  client: ApprovalsClient
  campaignName: string
  variants: VariantRow[]
  // The local gallery rows by variant ID.
  published: Map<string, VariantRecord>
  // A stop: checked between steps; FFmpeg is killed at once.
  signal: AbortSignal
  // approvals.progress without its IDs: before each still is drawn, each clip is made and each
  // clip upload, and once after the last file (progress-counter.ts).
  onStep(counts: PublishProgress): void
}

export type GalleryEntry = {
  v: VariantRow
  rev: number
  file: string
  clip: ClipMade | null
  missing: ClipMissing | null
}

// A storage failure: PROVIDER_ERROR with the provider's own sentence for its kind.
export async function storage<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    if (!(error instanceof ProviderFailure)) throw error
    const { kind } = error.error
    throw new AppError('PROVIDER_ERROR', plainMessage(kind, 'Amazon S3'), { provider: 's3', kind })
  }
}

function kindOf(error: unknown): string {
  if (error instanceof ProviderFailure) return error.error.kind
  if (error instanceof AppError) return error.code
  return 'other'
}

// One warn line for a picture step: IDs and the error kind only.
export function logPictureStep(
  deps: Pick<CoreDeps, 'log'>,
  pair: Pair,
  step: string,
  error: unknown,
) {
  deps.log.write({
    level: 'warn',
    event: 'provider',
    name: 'approvals.pictures',
    actor: 'system',
    ok: false,
    projectId: pair.projectId,
    campaignId: pair.campaignId,
    errorKind: kindOf(error),
    message: 'A step with the approval pictures could not be finished.',
    context: { step },
  })
}

type Plan = { draw: boolean; clip: 'make' | 'reuse' | ClipMissing | null }

// The table: what this run does with one variant and its local row.
function planFor(deps: CoreDeps, v: VariantRow, r: VariantRecord | undefined): Plan {
  const changed = r === undefined || r.publishedRev !== v.rev
  if (v.format !== 'video') return { draw: changed, clip: null }
  if (changed) return { draw: true, clip: clipBlocked(deps, v) ?? 'make' }
  if (r.clipMs !== null) return { draw: false, clip: 'reuse' }
  if (r.clipMissing === 'too_long' || r.clipMissing === 'too_large') {
    return { draw: false, clip: r.clipMissing }
  }
  return { draw: false, clip: clipBlocked(deps, v) ?? 'make' }
}

async function drawAndUpload(
  deps: CoreDeps,
  store: PictureStore,
  input: PublishInput,
  v: VariantRow,
  uploaded: string[],
) {
  const drawn = await deps.render.render(input.project, v.id, PICTURE_SIDE).catch(() => {
    throw new AppError('RULE_VIOLATION', renderFailedMessage(v.title), {
      reason: 'render_failed',
      variantId: v.id,
    })
  })
  const file = picturePath(input.pair.projectId, input.pair.campaignId, v.id, drawn.rev)
  uploaded.push(file)
  await storage(() => store.put(file, drawn.png))
  return { file, rev: drawn.rev }
}

export type GalleryFiles = { entries: GalleryEntry[]; drawn: number; clips: number }

export async function galleryFiles(
  deps: CoreDeps,
  store: PictureStore,
  input: PublishInput,
  uploaded: string[],
): Promise<GalleryFiles> {
  const { pair, signal } = input
  const plans = input.variants.map((v) => {
    const r = input.published.get(v.id)
    return { v, r, plan: planFor(deps, v, r) }
  })
  const stills = plans.filter((p) => p.plan.draw).length
  const total = plans.filter((p) => p.plan.clip === 'make').length
  const counter = progressCounter(stills, total, input.onStep)
  const entries: GalleryEntry[] = []
  let drawn = 0
  let tried = 0
  let clips = 0
  for (const { v, r, plan } of plans) {
    stopIfAsked(signal)
    let rev = r?.publishedRev ?? v.rev
    let file = picturePath(pair.projectId, pair.campaignId, v.id, rev)
    if (plan.draw) {
      counter.send('drawing', drawn, stills)
      ;({ file, rev } = await drawAndUpload(deps, store, input, v, uploaded))
      drawn += 1
      counter.add(1)
    }
    let clip: ClipMade | null = null
    let missing: ClipMissing | null = null
    if (plan.clip === 'reuse' && r?.clipMs && r.clipBytes) {
      const at = clipPath(pair.projectId, pair.campaignId, v.id, rev)
      clip = { file: at, durationMs: r.clipMs, bytes: r.clipBytes }
    } else if (plan.clip === 'make') {
      counter.send('making', tried, total)
      stopIfAsked(signal)
      let sent = false
      const made = await makeClip(deps, {
        project: input.project,
        pair,
        variant: v,
        rev,
        signal,
        put: (at, data) => {
          uploaded.push(at)
          return storage(() => store.putClip(at, data))
        },
        sending: () => {
          sent = true
          counter.add(1)
          counter.send('sending', tried, total)
        },
        logStep: (step, error) => logPictureStep(deps, pair, step, error),
      })
      tried += 1
      counter.add(sent ? 1 : 2)
      if (typeof made === 'string') {
        missing = made
      } else {
        clip = made
        clips += 1
      }
    } else if (plan.clip !== 'reuse') {
      missing = plan.clip
    }
    entries.push({ v, rev, file, clip, missing })
  }
  counter.finish()
  return { entries, drawn, clips }
}

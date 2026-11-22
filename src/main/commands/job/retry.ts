// job.retry (SPEC 4.2 notes; FR-069, FR-152): a new job from the old row's request, with the
// same campaign, variant, layer and slot. The old row stays. The key guard runs again.
import { defineCommand, type PrepareContext } from '@/main/commands/types'
import { checkVideoRetryRequest } from '@/main/commands/generation/video-start-checks'
import type { CoreDeps } from '@/main/core-deps'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { requireJob, wrongState } from './find-job'
import { jobRetryInput, type JobRetryInput, type JobStarted } from '@/shared/schemas/commands/job'
import { imageJobRequest } from '@/shared/schemas/jobs/image-generation'
import {
  checkComfyCutout,
  checkComfyExtend,
  checkComfyRun,
} from '@/main/commands/generation/comfy-checks'
import { checkLicence } from '@/main/commands/generation/licence-check'
import { keptPictureCount, picturesLeft } from '@/shared/generation/pictures-left'
import { promptToSend } from '@/shared/generation/prompt'
import type { JobRow } from '@/shared/schemas/rows/job'

type Deps = Pick<CoreDeps, 'jobs' | 'providers' | 'secrets' | 'settings' | 'devTools' | 'assets'>

// [CU-6a, 14 1.53; 1.60 N-5; P7-11] A video job of any provider is checked as
// generation.startVideo checks it, pictures, offer and format included, in prepare, since
// reading a picture is not done in the transaction. The licence check (S2-4) is among them.
// The checks run whatever the old row's status, so a row that ends between prepare and run is
// never retried unchecked; run still refuses a row that did not fail and was not cancelled.
async function checkVideoRetry(deps: Deps, ctx: PrepareContext, input: JobRetryInput) {
  const old = requireJob(ctx.project, input.jobId)
  if (old.kind !== 'video_generation' || !old.provider) return
  await checkVideoRetryRequest(deps, ctx, old, input.licenceConfirmed)
}

// The two fields the prompt's ending depends on, shared by picture and video requests.
const promptPart = imageJobRequest.pick({ prompt: true, referenceAssetIds: true })

// [SP-9] A picture or video row is stored with the ending its pictures call for, so a row
// made before the two-ending rule holds the ending it is sent with. Only the prompt changes.
function withEnding(old: JobRow): unknown {
  if (old.kind !== 'image_generation' && old.kind !== 'video_generation') return old.request
  const part = promptPart.safeParse(old.request)
  if (!part.success) return old.request
  const pictures = part.data.referenceAssetIds.length
  return { ...(old.request as object), prompt: promptToSend(part.data.prompt, { pictures }) }
}

// [FN-4] A picture job that kept pictures asks only for the ones not yet made.
function retryRequest(old: JobRow): unknown {
  const request = withEnding(old)
  if (old.kind !== 'image_generation' || keptPictureCount(old.result) === 0) return request
  const { count } = imageJobRequest.parse(old.request)
  return { ...(request as object), count: picturesLeft(count, old.result) }
}

export function jobRetry(deps: Deps) {
  return defineCommand({
    name: 'job.retry',
    input: jobRetryInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input) {
      await checkVideoRetry(deps, ctx, input)
    },
    run(ctx, input) {
      const old = requireJob(ctx.project, input.jobId)
      const retryable = old.status === 'failed' || old.status === 'cancelled'
      if (!retryable || !old.provider) {
        throw wrongState('Only a job that failed or was cancelled can be tried again.')
      }
      requireProviderKeys(deps, old.provider, 'try this again')
      // [1.53] G-2, S2-4: a ComfyUI picture row passes the same checks as
      // generation.runImages, the licence check included.
      if (old.provider === 'comfyui' && old.kind === 'image_generation') {
        const { referenceAssetIds } = imageJobRequest.parse(old.request)
        const spec = checkComfyRun(deps, ctx, referenceAssetIds.length)
        checkLicence(deps, ctx, spec, input.licenceConfirmed)
      }
      // P4-11 (spec/ai-jobs.md "Cut-out" step 4): a ComfyUI cut-out passes its checks again.
      if (old.provider === 'comfyui' && old.kind === 'cutout') {
        checkComfyCutout(deps, ctx, input.licenceConfirmed)
      }
      // spec/links-and-sync.md "Generative fill" step 2: a ComfyUI fill passes its checks again.
      if (old.provider === 'comfyui' && old.kind === 'generative_fill') {
        checkComfyExtend(deps, ctx, input.licenceConfirmed)
      }
      const jobId = deps.jobs.enqueue(ctx, {
        kind: old.kind,
        campaignId: old.campaignId,
        variantId: old.variantId,
        layerId: old.layerId,
        slot: old.slot,
        provider: old.provider,
        model: old.model ?? '',
        request: retryRequest(old),
        startedBy: 'user',
      })
      const data: JobStarted = { jobId }
      return { data, log: { campaignId: old.campaignId ?? undefined } }
    },
  })
}

// job.retry (SPEC 4.2 notes; FR-069, FR-152): a new job from the old row's request, with the
// same campaign, variant, layer and slot. The old row stays. The key guard runs again.
import { defineCommand, type PrepareContext } from '../types'
import { checkComfyVideoRetry } from '../generation/video-start-checks'
import type { CoreDeps } from '../../core-deps'
import { requireProviderKeys } from '../../providers/require-keys'
import { requireJob, wrongState } from './find-job'
import { jobRetryInput, type JobStarted } from '../../../shared/schemas/commands/job'
import { imageJobRequest } from '../../../shared/schemas/jobs/image-generation'
import { checkComfyRun } from '../generation/comfy-checks'

type Deps = Pick<CoreDeps, 'jobs' | 'providers' | 'secrets' | 'settings' | 'devTools' | 'assets'>

// [CU-6a, 14 1.53; 1.60 N-5] A ComfyUI video job is checked as generation.startVideo checks
// it, pictures included, in prepare, since reading a picture is not done in the transaction.
async function checkVideoRetry(deps: Deps, ctx: PrepareContext, jobId: string): Promise<void> {
  const old = requireJob(ctx.project, jobId)
  // A row that cannot be retried is refused by run, as before.
  if (old.status !== 'failed' && old.status !== 'cancelled') return
  if (old.provider !== 'comfyui' || old.kind !== 'video_generation') return
  await checkComfyVideoRetry(deps, ctx, old.request)
}

export function jobRetry(deps: Deps) {
  return defineCommand({
    name: 'job.retry',
    input: jobRetryInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input) {
      await checkVideoRetry(deps, ctx, input.jobId)
    },
    run(ctx, input) {
      const old = requireJob(ctx.project, input.jobId)
      const retryable = old.status === 'failed' || old.status === 'cancelled'
      if (!retryable || !old.provider) {
        throw wrongState('Only a job that failed or was cancelled can be tried again.')
      }
      requireProviderKeys(deps, old.provider, 'try this again')
      // [1.53] G-2: a ComfyUI picture row passes the same checks as generation.runImages.
      if (old.provider === 'comfyui' && old.kind === 'image_generation') {
        const { referenceAssetIds } = imageJobRequest.parse(old.request)
        checkComfyRun(deps, ctx, referenceAssetIds.length)
      }
      const jobId = deps.jobs.enqueue(ctx, {
        kind: old.kind,
        campaignId: old.campaignId,
        variantId: old.variantId,
        layerId: old.layerId,
        slot: old.slot,
        provider: old.provider,
        model: old.model ?? '',
        request: old.request,
        startedBy: 'user',
      })
      const data: JobStarted = { jobId }
      return { data, log: { campaignId: old.campaignId ?? undefined } }
    },
  })
}

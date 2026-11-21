// job.retry (SPEC 4.2 notes; FR-069, FR-152): a new job from the old row's request, with the
// same campaign, variant, layer and slot. The old row stays. The key guard runs again.
import { defineCommand } from '../types'
import type { CoreDeps } from '../../core-deps'
import { requireProviderKeys } from '../../providers/require-keys'
import { requireJob, wrongState } from './find-job'
import { jobRetryInput, type JobStarted } from '../../../shared/schemas/commands/job'
import { imageJobRequest } from '../../../shared/schemas/jobs/image-generation'
import { checkComfyRun } from '../generation/comfy-checks'

type Deps = Pick<CoreDeps, 'jobs' | 'providers' | 'secrets' | 'devTools' | 'settings'>

export function jobRetry(deps: Deps) {
  return defineCommand({
    name: 'job.retry',
    input: jobRetryInput,
    projectId: (input) => input.projectId,
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

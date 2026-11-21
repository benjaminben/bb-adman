// generation.startVideo (SPEC 4.2, 6.10.7 "Into the project"; 14 1.41 CU-6a, 1.45 A-4,
// 1.60 CU-6b). Checks the provider and the variant, calls the key guard, then makes the start
// checks: the start pair, the ComfyUI checks for that pair, and each picture. Then it enqueues
// one video_generation job with the variant's and its campaign's IDs and returns its ID at
// once. run checks the variant again inside the transaction (SPEC 3.6).
import { defineCommand, type ProjectContext } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRow } from '@/main/db/rows'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { checkVideoStart } from './video-start-checks'
import { promptToSend } from '@/shared/generation/prompt'
import {
  generationStartVideoInput,
  type GenerationStartVideoInput,
} from '@/shared/schemas/commands/generation'
import type { VideoJobRequest } from '@/shared/schemas/jobs/video-generation'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { AppError } from '@/shared/schemas/result'

type Deps = Pick<CoreDeps, 'jobs' | 'providers' | 'secrets' | 'settings' | 'devTools' | 'assets'>
type Target = { campaignId: string; width: number; height: number }

// SPEC 4.1 "Choosing a code": a provider chosen for a job it does not do is INVALID_INPUT.
function videoProvider(deps: Deps, id: string): ProviderInfo {
  const info = deps.providers.find((p) => p.id === id)
  if (!info?.available || !info.jobs.includes('video')) {
    throw new AppError('INVALID_INPUT', 'That provider cannot make videos.', { provider: id })
  }
  return info
}

function target(project: ProjectHandle, variantId: string): Target {
  type Variant = { directionId: string; width: number; height: number }
  const variant = readWireRow(project.db, 'variant', { id: variantId }) as Variant | null
  const direction =
    variant &&
    (readWireRow(project.db, 'direction', { id: variant.directionId }) as {
      campaignId: string
    } | null)
  if (!variant || !direction) throw new AppError('NOT_FOUND', 'That variant was not found.')
  return { campaignId: direction.campaignId, width: variant.width, height: variant.height }
}

function enqueue(deps: Deps, ctx: ProjectContext, input: GenerationStartVideoInput) {
  const provider = videoProvider(deps, input.provider)
  const place = target(ctx.project, input.variantId)
  // [1.60] The stored request keeps the start and the picture IDs prepare checked.
  const request: VideoJobRequest = {
    prompt: promptToSend(input.prompt, { pictures: input.referenceAssetIds.length }),
    durationMs: input.durationMs,
    width: place.width,
    height: place.height,
    start: input.start,
    referenceAssetIds: input.referenceAssetIds,
  }
  const jobId = deps.jobs.enqueue(ctx, {
    kind: 'video_generation',
    campaignId: place.campaignId,
    variantId: input.variantId,
    layerId: null,
    slot: null,
    provider: provider.id,
    model: provider.defaultModels.video ?? '',
    request,
    startedBy: ctx.actor === 'agent' ? 'agent' : 'user',
  })
  return { jobId, campaignId: place.campaignId }
}

export function generationStartVideo(deps: Deps) {
  return defineCommand({
    name: 'generation.startVideo',
    input: generationStartVideoInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input) {
      const provider = videoProvider(deps, input.provider)
      target(ctx.project, input.variantId)
      requireProviderKeys(deps, provider.id, 'make videos')
      await checkVideoStart(deps, ctx, provider.id, input)
    },
    run(ctx, input) {
      const { jobId, campaignId } = enqueue(deps, ctx, input)
      return { data: { jobId }, log: { campaignId, variantId: input.variantId } }
    },
  })
}

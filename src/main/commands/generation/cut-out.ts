// generation.cutOut (spec/ai-jobs.md "Cut-out"; FR-307). In prepare, in order: the provider,
// the layer and its picture, the key guard, the ComfyUI checks (licence last; an agent never
// confirms it), then the source read through AssetService.read, so only a clean PNG is sent.
// run checks the rows again inside the transaction and enqueues one background cutout job.
import { defineCommand, type ProjectContext } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRow } from '@/main/db/rows'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { checkComfyCutout } from './comfy-checks'
import {
  generationCutOutInput,
  type GenerationCutOutInput,
} from '@/shared/schemas/commands/generation'
import type { CutoutJobRequest } from '@/shared/schemas/jobs/cutout'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { AppError } from '@/shared/schemas/result'

type Deps = Pick<CoreDeps, 'jobs' | 'providers' | 'secrets' | 'assets' | 'settings' | 'devTools'>
type Layer = { variantId: string; type: string; source: { assetId: string } | null }
type Target = { campaignId: string; sourceAssetId: string }

function cutoutProvider(deps: Deps, id: string): ProviderInfo {
  const info = deps.providers.find((p) => p.id === id)
  if (!info?.available || !info.jobs.includes('cutout')) {
    throw new AppError('INVALID_INPUT', 'That provider cannot cut out pictures.', { provider: id })
  }
  return info
}

function target(project: ProjectHandle, input: GenerationCutOutInput): Target {
  const layer = readWireRow(project.db, 'layer', { id: input.layerId }) as Layer | null
  if (layer?.variantId !== input.variantId) {
    throw new AppError('NOT_FOUND', 'That layer was not found in this variant.')
  }
  if (layer.type !== 'image' && layer.type !== 'background') {
    throw new AppError('INVALID_INPUT', 'Cut-outs are made from a picture layer.')
  }
  if (!layer.source) {
    throw new AppError('INVALID_INPUT', 'Choose a picture for this layer first.')
  }
  const variant = readWireRow(project.db, 'variant', { id: input.variantId }) as {
    directionId: string
  } | null
  const direction =
    variant &&
    (readWireRow(project.db, 'direction', { id: variant.directionId }) as {
      campaignId: string
    } | null)
  if (!direction) throw new AppError('NOT_FOUND', 'That layer was not found in this variant.')
  return { campaignId: direction.campaignId, sourceAssetId: layer.source.assetId }
}

function enqueue(deps: Deps, ctx: ProjectContext, input: GenerationCutOutInput) {
  const provider = cutoutProvider(deps, input.provider)
  const place = target(ctx.project, input)
  const request: CutoutJobRequest = { sourceAssetId: place.sourceAssetId }
  const jobId = deps.jobs.enqueue(ctx, {
    kind: 'cutout',
    campaignId: place.campaignId,
    variantId: input.variantId,
    layerId: input.layerId,
    slot: null,
    provider: provider.id,
    model: provider.defaultModels.cutout ?? '',
    request,
    startedBy: ctx.actor === 'agent' ? 'agent' : 'user',
  })
  return { jobId, campaignId: place.campaignId }
}

export function generationCutOut(deps: Deps) {
  return defineCommand({
    name: 'generation.cutOut',
    input: generationCutOutInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input) {
      const provider = cutoutProvider(deps, input.provider)
      const place = target(ctx.project, input)
      requireProviderKeys(deps, provider.id, 'cut out a picture')
      if (provider.id === 'comfyui') checkComfyCutout(deps, ctx, input.licenceConfirmed)
      await deps.assets.read(ctx.project, place.sourceAssetId)
    },
    run(ctx, input) {
      const { jobId, campaignId } = enqueue(deps, ctx, input)
      return { data: { jobId }, log: { campaignId, variantId: input.variantId } }
    },
  })
}

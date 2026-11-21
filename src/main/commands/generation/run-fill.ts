// generation.runFill (spec/links-and-sync.md "Generative fill"; A-132, A-146). In prepare, in
// order: the variant and its background (A-132), the provider, the key guard, the ComfyUI
// checks (licence last; an agent never confirms it), then the source read through
// AssetService.read, so only a clean PNG of this project is sent. run checks the rows again
// inside the transaction and enqueues one generative_fill job. A gate run command for agents.
import { defineCommand, type ProjectContext } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRow } from '@/main/db/rows'
import { masterOf } from '@/main/links/master-of'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { checkComfyExtend } from './comfy-checks'
import { FILL_PROMPT, promptToSend } from '@/shared/generation/prompt'
import {
  generationRunFillInput,
  type GenerationRunFillInput,
  type GenerationRunFillReply,
} from '@/shared/schemas/commands/generation'
import type { GenerativeFillJobRequest } from '@/shared/schemas/jobs/generative-fill'
import type { Geometry } from '@/shared/schemas/layer'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { AppError } from '@/shared/schemas/result'

type Deps = Pick<CoreDeps, 'jobs' | 'providers' | 'secrets' | 'assets' | 'settings' | 'devTools'>
type Variant = { id: string; directionId: string; width: number; height: number }
type Background = {
  id: string
  type: string
  source: { assetId: string } | null
  geometry: Geometry
}
type Target = { campaignId: string; layerId: string; request: GenerativeFillJobRequest }

const PURPOSE = 'generate a fill'

const refuse = (reason: string, message: string) =>
  new AppError('RULE_VIOLATION', message, { reason })

function pictureProvider(deps: Deps, id: string): ProviderInfo {
  const info = deps.providers.find((p) => p.id === id)
  if (!info?.available || !info.jobs.includes('image')) {
    throw new AppError('INVALID_INPUT', 'That provider cannot make pictures.', { provider: id })
  }
  return info
}

function background(project: ProjectHandle, variantId: string): Background {
  const row = project.db
    .prepare(`SELECT id FROM layer WHERE variant_id = ? AND type = 'background' LIMIT 1`)
    .get(variantId) as { id: string } | undefined
  const found = row && (readWireRow(project.db, 'layer', { id: row.id }) as Background | null)
  if (!found) throw new AppError('NOT_FOUND', 'That variant has no background layer.')
  return found
}

// A-132: the box covers the canvas when no edge of the variant is left uncovered.
function covers(box: Geometry, variant: Variant): boolean {
  return (
    box.x <= 0 &&
    box.y <= 0 &&
    box.x + box.width >= variant.width &&
    box.y + box.height >= variant.height
  )
}

// Step 1: the variant (not its direction's master: a fill is placed only on the sizes made
// from it), its background layer and the four refusals of A-132, in order.
function target(project: ProjectHandle, input: GenerationRunFillInput): Target {
  const variant = readWireRow(project.db, 'variant', { id: input.variantId }) as Variant | null
  const direction =
    variant &&
    (readWireRow(project.db, 'direction', { id: variant.directionId }) as {
      campaignId: string
    } | null)
  if (!variant || !direction) throw new AppError('NOT_FOUND', 'That variant was not found.')
  if (masterOf(project.db, variant.directionId)?.variant.id === variant.id) {
    throw refuse(
      'master_variant',
      'A fill is made for a size made from the master, not for the master itself.',
    )
  }
  const layer = background(project, variant.id)
  const box = layer.geometry
  if (!layer.source) {
    throw refuse('no_background_picture', 'This variant has no background picture to extend.')
  }
  if (box.rotation !== 0) {
    throw refuse('background_turned', 'Straighten the background before generating a fill.')
  }
  if (box.crop !== null) {
    throw refuse('background_cropped', "Reset the background's crop before generating a fill.")
  }
  if (covers(box, variant)) {
    throw refuse('background_covers', 'The background already covers the whole variant.')
  }
  const request: GenerativeFillJobRequest = {
    prompt: promptToSend(FILL_PROMPT, { pictures: 1 }),
    sourceAssetId: layer.source.assetId,
    placement: { x: box.x, y: box.y, width: box.width, height: box.height },
    width: variant.width,
    height: variant.height,
  }
  return { campaignId: direction.campaignId, layerId: layer.id, request }
}

function enqueue(deps: Deps, ctx: ProjectContext, input: GenerationRunFillInput) {
  const place = target(ctx.project, input)
  const provider = pictureProvider(deps, input.provider)
  const jobId = deps.jobs.enqueue(ctx, {
    kind: 'generative_fill',
    campaignId: place.campaignId,
    variantId: input.variantId,
    layerId: place.layerId,
    slot: null,
    provider: provider.id,
    model: provider.defaultModels.image ?? '',
    request: place.request,
    startedBy: ctx.actor === 'agent' ? 'agent' : 'user',
  })
  return { jobId, campaignId: place.campaignId }
}

export function generationRunFill(deps: Deps) {
  return defineCommand({
    name: 'generation.runFill',
    input: generationRunFillInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input) {
      const place = target(ctx.project, input)
      const provider = pictureProvider(deps, input.provider)
      requireProviderKeys(deps, provider.id, PURPOSE)
      if (provider.id === 'comfyui') checkComfyExtend(deps, ctx, input.licenceConfirmed)
      await deps.assets.read(ctx.project, place.request.sourceAssetId)
    },
    run(ctx, input) {
      const { jobId, campaignId } = enqueue(deps, ctx, input)
      const data: GenerationRunFillReply = { jobId }
      return { data, log: { campaignId, variantId: input.variantId } }
    },
  })
}

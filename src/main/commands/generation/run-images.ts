// generation.runImages (SPEC 4.2, 3.6 "Jobs" item 1; SPEC 14 slice H; FR-062 to FR-065).
// Checks the provider, the variant and the layer or slot, calls the key guard, reads each
// reference picture, then enqueues one image_generation job and returns its ID at once.
// prepare does the checks that read files; run checks the rows again inside the
// transaction, since another command may have changed them in between (SPEC 3.6).
import { defineCommand, type ProjectContext } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRow } from '@/main/db/rows'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { checkComfyRun } from './comfy-checks'
import { checkLicence } from './licence-check'
import { starterTemplate } from '@/shared/templates/starter'
import { promptToSend } from '@/shared/generation/prompt'
import {
  generationRunImagesInput,
  type GenerationRunImagesInput,
} from '@/shared/schemas/commands/generation'
import type { ImageJobRequest } from '@/shared/schemas/jobs/image-generation'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { WorkflowId } from '@/shared/schemas/queries/comfy'
import { AppError } from '@/shared/schemas/result'

type Deps = Pick<
  CoreDeps,
  'jobs' | 'providers' | 'secrets' | 'assets' | 'settings' | 'devTools' | 'comfyWorkflows'
>
type Target = { campaignId: string; width: number; height: number }

const TEMPLATES = [starterTemplate]

// SPEC 4.1 "Choosing a code": a provider chosen for a job it does not do is INVALID_INPUT.
function pictureProvider(deps: Deps, id: string): ProviderInfo {
  const info = deps.providers.find((p) => p.id === id)
  if (!info?.available || !info.jobs.includes('image')) {
    throw new AppError('INVALID_INPUT', 'That provider cannot make pictures.', { provider: id })
  }
  return info
}

const side = (n: number) => Math.max(1, Math.round(n))

function row<T>(project: ProjectHandle, table: 'variant' | 'direction' | 'campaign', id: string) {
  return readWireRow(project.db, table, { id }) as T | null
}

// SPEC 4.2 notes: any image or background layer of the variant, or an image slot of the
// variant's template. A layer gives its box as the size (OI-70); a slot the variant's size.
function target(project: ProjectHandle, input: GenerationRunImagesInput): Target {
  type Variant = { directionId: string; width: number; height: number }
  const variant = row<Variant>(project, 'variant', input.variantId)
  const direction =
    variant && row<{ campaignId: string }>(project, 'direction', variant.directionId)
  const campaign =
    direction && row<{ templateId: string }>(project, 'campaign', direction.campaignId)
  if (!variant || !direction || !campaign) {
    throw new AppError('NOT_FOUND', 'That variant was not found.')
  }
  if (input.layerId !== undefined) {
    const layer = readWireRow(project.db, 'layer', { id: input.layerId }) as {
      variantId: string
      type: string
      geometry: { width: number; height: number }
    } | null
    if (layer?.variantId !== input.variantId) {
      throw new AppError('NOT_FOUND', 'That layer was not found in this variant.')
    }
    if (layer.type !== 'image' && layer.type !== 'background') {
      throw new AppError('INVALID_INPUT', 'Pictures can only be made for a picture layer.')
    }
    // OI-70: a layer run asks for the shape of the layer's box, background included.
    const { width, height } = layer.geometry
    return { campaignId: direction.campaignId, width: side(width), height: side(height) }
  } else {
    const template = TEMPLATES.find((t) => t.id === campaign.templateId)
    const slot = template?.slots.find((s) => s.id === input.slot)
    if (slot?.type !== 'image') {
      throw new AppError('INVALID_INPUT', 'That slot does not take a picture.')
    }
  }
  return { campaignId: direction.campaignId, width: variant.width, height: variant.height }
}

// D-104: the ComfyUI workflow prepare chose, written into the job's request.
type Prepared = { workflowId?: WorkflowId }

function enqueue(
  deps: Deps,
  ctx: ProjectContext,
  input: GenerationRunImagesInput,
  prepared: Prepared,
) {
  const provider = pictureProvider(deps, input.provider)
  const place = target(ctx.project, input)
  const request: ImageJobRequest = {
    prompt: promptToSend(input.prompt, { pictures: input.referenceAssetIds.length }),
    referenceAssetIds: input.referenceAssetIds,
    count: input.count,
    width: place.width,
    height: place.height,
    ...(prepared.workflowId !== undefined && { workflowId: prepared.workflowId }),
  }
  const jobId = deps.jobs.enqueue(ctx, {
    kind: 'image_generation',
    campaignId: place.campaignId,
    variantId: input.variantId,
    layerId: input.layerId ?? null,
    slot: input.layerId === undefined ? (input.slot ?? null) : null,
    provider: provider.id,
    model: provider.defaultModels.image ?? '',
    request,
    startedBy: ctx.actor === 'agent' ? 'agent' : 'user',
  })
  return { jobId, campaignId: place.campaignId }
}

export function generationRunImages(deps: Deps) {
  return defineCommand({
    name: 'generation.runImages',
    input: generationRunImagesInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input): Promise<Prepared> {
      const provider = pictureProvider(deps, input.provider)
      target(ctx.project, input)
      requireProviderKeys(deps, provider.id, 'generate pictures')
      // CU-4: the ComfyUI checks, before any picture is read or any job row is made. S2-4:
      // the licence check comes last, so the user confirms only a run that can start.
      // D-104: the named workflow, or the default, and its reference count.
      const refs = input.referenceAssetIds.length
      const spec =
        provider.id === 'comfyui' ? checkComfyRun(deps, ctx, refs, input.workflowId) : null
      for (const id of input.referenceAssetIds) await deps.assets.read(ctx.project, id)
      if (spec) checkLicence(deps, ctx, spec, input.licenceConfirmed)
      return spec ? { workflowId: spec.id } : {}
    },
    run(ctx, input, prepared) {
      const { jobId, campaignId } = enqueue(deps, ctx, input, prepared)
      return { data: { jobId }, log: { campaignId, variantId: input.variantId } }
    },
  })
}

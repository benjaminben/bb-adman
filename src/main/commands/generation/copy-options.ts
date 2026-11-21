// generation.copyOptions (spec/ai-jobs.md "Copy options"; FR-043, FR-045). Checks the provider,
// then the layer, then the key, and enqueues one attached copy_options job with campaign,
// variant and layer. prepare checks before any job row; run checks the rows again inside the
// transaction, since another command may have changed them in between (SPEC 3.6).
import { defineCommand, type ProjectContext } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRow } from '@/main/db/rows'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { COPY_MAX_CHARS } from '@/shared/config/copy-options'
import {
  generationCopyOptionsInput,
  type GenerationCopyOptionsInput,
} from '@/shared/schemas/commands/generation'
import type { CopyJobRequest } from '@/shared/schemas/jobs/copy-options'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { AppError } from '@/shared/schemas/result'

type Deps = Pick<CoreDeps, 'jobs' | 'providers' | 'secrets'>
type Layer = { variantId: string; type: string; slot: string | null }
type Target = { campaignId: string; request: Omit<CopyJobRequest, 'count'> }

function textProvider(deps: Deps, id: string): ProviderInfo {
  const info = deps.providers.find((p) => p.id === id)
  if (!info?.available || !info.jobs.includes('text')) {
    throw new AppError('INVALID_INPUT', 'That provider cannot write copy.', { provider: id })
  }
  return info
}

function target(project: ProjectHandle, input: GenerationCopyOptionsInput): Target {
  const layer = readWireRow(project.db, 'layer', { id: input.layerId }) as Layer | null
  if (layer?.variantId !== input.variantId) {
    throw new AppError('NOT_FOUND', 'That layer was not found in this variant.')
  }
  if (layer.type !== 'text') {
    throw new AppError('INVALID_INPUT', 'Copy options are for text layers.')
  }
  // FR-043: the headline is the campaign message, word for word.
  if (layer.slot === 'headline') {
    throw new AppError(
      'INVALID_INPUT',
      'The headline is the campaign message. Change the message instead.',
    )
  }
  const variant = readWireRow(project.db, 'variant', { id: input.variantId }) as {
    directionId: string
    language: string
  } | null
  const direction =
    variant &&
    (readWireRow(project.db, 'direction', { id: variant.directionId }) as {
      campaignId: string
    } | null)
  if (!variant || !direction) {
    throw new AppError('NOT_FOUND', 'That layer was not found in this variant.')
  }
  const role = layer.slot === 'call-to-action' ? 'call_to_action' : 'text'
  return {
    campaignId: direction.campaignId,
    request: { role, language: variant.language, maxChars: COPY_MAX_CHARS[role] },
  }
}

function enqueue(deps: Deps, ctx: ProjectContext, input: GenerationCopyOptionsInput) {
  const provider = textProvider(deps, input.provider)
  const place = target(ctx.project, input)
  const request: CopyJobRequest = { ...place.request, count: input.count }
  const jobId = deps.jobs.enqueue(ctx, {
    kind: 'copy_options',
    campaignId: place.campaignId,
    variantId: input.variantId,
    layerId: input.layerId,
    slot: null,
    provider: provider.id,
    model: provider.defaultModels.text ?? '',
    request,
    startedBy: ctx.actor === 'agent' ? 'agent' : 'user',
  })
  return { jobId, campaignId: place.campaignId }
}

export function generationCopyOptions(deps: Deps) {
  return defineCommand({
    name: 'generation.copyOptions',
    input: generationCopyOptionsInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input) {
      const provider = textProvider(deps, input.provider)
      target(ctx.project, input)
      requireProviderKeys(deps, provider.id, 'suggest copy')
    },
    run(ctx, input) {
      const { jobId, campaignId } = enqueue(deps, ctx, input)
      return { data: { jobId }, log: { campaignId, variantId: input.variantId } }
    },
  })
}

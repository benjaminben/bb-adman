// generation.proposeLayout (spec/ai-jobs.md "Layout proposal"; FR-061, workflow 5.1 step 6).
// prepare checks, in order: the provider places text, the variant exists, it has a visible
// text layer with copy, the key guard. run checks the rows again inside the transaction, then
// enqueues one attached layout_proposal job. The job reads the variant when it runs.
import { defineCommand, type ProjectContext } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRow } from '@/main/db/rows'
import { layoutItems } from '@/main/jobs/kinds/layout-proposal'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { variantLayers } from '@/main/thumbnails/scene-input'
import {
  generationProposeLayoutInput,
  type GenerationProposeLayoutInput,
} from '@/shared/schemas/commands/generation'
import type { LayoutJobRequest } from '@/shared/schemas/jobs/layout-proposal'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { AppError } from '@/shared/schemas/result'

type Deps = Pick<CoreDeps, 'jobs' | 'providers' | 'secrets'>

function layoutProvider(deps: Deps, id: string): ProviderInfo {
  const info = deps.providers.find((p) => p.id === id)
  if (!info?.available || !info.jobs.includes('layout')) {
    throw new AppError('INVALID_INPUT', 'That provider cannot place text.', { provider: id })
  }
  return info
}

// The variant's campaign, once the variant and its text are checked.
function campaignOf(project: ProjectHandle, variantId: string): string {
  const variant = readWireRow(project.db, 'variant', { id: variantId }) as {
    directionId: string
  } | null
  const direction =
    variant &&
    (readWireRow(project.db, 'direction', { id: variant.directionId }) as {
      campaignId: string
    } | null)
  if (!direction) throw new AppError('NOT_FOUND', 'That variant was not found.')
  if (layoutItems(variantLayers(project, variantId)).length === 0) {
    throw new AppError('INVALID_INPUT', 'Add text to a text layer first.')
  }
  return direction.campaignId
}

function enqueue(deps: Deps, ctx: ProjectContext, input: GenerationProposeLayoutInput) {
  const provider = layoutProvider(deps, input.provider)
  const campaignId = campaignOf(ctx.project, input.variantId)
  const request: LayoutJobRequest = {}
  const jobId = deps.jobs.enqueue(ctx, {
    kind: 'layout_proposal',
    campaignId,
    variantId: input.variantId,
    layerId: null,
    slot: null,
    provider: provider.id,
    model: provider.defaultModels.layout ?? '',
    request,
    startedBy: ctx.actor === 'agent' ? 'agent' : 'user',
  })
  return { jobId, campaignId }
}

export function generationProposeLayout(deps: Deps) {
  return defineCommand({
    name: 'generation.proposeLayout',
    input: generationProposeLayoutInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input) {
      const provider = layoutProvider(deps, input.provider)
      campaignOf(ctx.project, input.variantId)
      requireProviderKeys(deps, provider.id, 'place text with AI')
    },
    run(ctx, input) {
      const { jobId, campaignId } = enqueue(deps, ctx, input)
      return { data: { jobId }, log: { campaignId, variantId: input.variantId } }
    },
  })
}

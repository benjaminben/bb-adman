// Starts the translation jobs of one direction and language (spec/phases/phase-06.md, design
// addition 2, step 5, and section 7): shared by translation.propose and fan-out (P6-15). One
// attached `translation` job per group, with the campaign set and no variant, layer or slot.
// The caller has checked the provider and its key.
import type { ProjectContext } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import type { TranslationJobRequest } from '@/shared/schemas/jobs/translation'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { planGroup, type TranslationGroup, type TranslationPlan } from './targets'

export type StartTranslations = TranslationGroup & {
  provider: ProviderInfo
  startedBy: 'user' | 'agent'
  mode?: TranslationJobRequest['mode']
}

export function enqueueTranslation(
  deps: Pick<CoreDeps, 'jobs'>,
  ctx: ProjectContext,
  plan: TranslationPlan,
  provider: ProviderInfo,
  startedBy: 'user' | 'agent',
): string {
  return deps.jobs.enqueue(ctx, {
    kind: 'translation',
    campaignId: plan.campaignId,
    variantId: null,
    layerId: null,
    slot: null,
    provider: provider.id,
    model: provider.defaultModels.text ?? '',
    request: plan.request,
    startedBy,
  })
}

// The job IDs started: none when the master has no text or no layer may be replaced.
export function startTranslations(
  deps: Pick<CoreDeps, 'jobs'>,
  ctx: ProjectContext,
  start: StartTranslations,
): string[] {
  const plan = planGroup(ctx.project.db, start, start.mode ?? 'write')
  return plan ? [enqueueTranslation(deps, ctx, plan, start.provider, start.startedBy)] : []
}

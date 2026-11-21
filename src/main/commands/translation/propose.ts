// translation.propose (spec/phases/phase-06.md, design addition 2; A-154, A-156, A-157). Checks
// the provider, then the posts, then the key, all in prepare before any job row; run checks the
// rows again inside the transaction and starts one translation job per direction and language.
// Agent policy deny (A-169), so only the window starts an AI translation.
import type Database from 'better-sqlite3'
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { enqueueTranslation } from '@/main/translation/start'
import { groupsFor, planGroup, type TranslationPlan } from '@/main/translation/targets'
import {
  translationProposeInput,
  type TranslationProposeInput,
  type TranslationProposeReply,
} from '@/shared/schemas/commands/translation'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { AppError } from '@/shared/schemas/result'

type Deps = Pick<CoreDeps, 'jobs' | 'providers' | 'secrets'>

function translateProvider(deps: Deps, id: string): ProviderInfo {
  const info = deps.providers.find((p) => p.id === id)
  if (!info?.available || !info.jobs.includes('text')) {
    throw new AppError('INVALID_INPUT', 'That provider cannot translate.', { provider: id })
  }
  return info
}

// Steps 2 to 4: one plan per group that has text and a layer to replace; refuses when none has.
function plansFor(db: Database.Database, input: TranslationProposeInput): TranslationPlan[] {
  const plans = groupsFor(db, input)
    .map((group) => planGroup(db, group, input.mode))
    .filter((plan): plan is TranslationPlan => plan !== null)
  if (plans.length === 0) {
    throw new AppError('RULE_VIOLATION', 'There is no text to translate.', {
      reason: 'nothing_to_translate',
    })
  }
  return plans
}

export function translationPropose(deps: Deps) {
  return defineCommand({
    name: 'translation.propose',
    input: translationProposeInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input) {
      const provider = translateProvider(deps, input.provider)
      plansFor(ctx.project.db, input)
      requireProviderKeys(deps, provider.id, 'translate')
    },
    run(ctx, input) {
      const provider = translateProvider(deps, input.provider)
      const startedBy = ctx.actor === 'agent' ? 'agent' : 'user'
      const plans = plansFor(ctx.project.db, input)
      const jobIds = plans.map((plan) => enqueueTranslation(deps, ctx, plan, provider, startedBy))
      const data: TranslationProposeReply = { jobIds }
      return { data, log: { campaignId: plans[0]?.campaignId } }
    },
  })
}

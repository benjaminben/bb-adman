// The translation query domain (spec/phases/phase-06.md, design addition 1):
// translation.forCampaign. Both actors may read it. Stub (P6-1): checks the input and the
// campaign, then answers no rows and no jobs until P6-7 replaces the body.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { openFor, requireCampaign } from './campaign-reads'
import {
  translationForCampaignInput,
  type TranslationForCampaign,
} from '@/shared/schemas/queries/translation'

export function translationForCampaign(deps: Pick<CoreDeps, 'projects'>): QueryFn {
  return (raw): TranslationForCampaign => {
    const { input, project } = openFor(deps, translationForCampaignInput, raw)
    const campaign = requireCampaign(project.db, input.campaignId)
    return { primaryLanguage: campaign.primaryLanguage, rows: [], jobs: [] }
  }
}

export function translationQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'translation.forCampaign': translationForCampaign(deps) }
}

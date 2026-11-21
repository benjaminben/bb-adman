// The translation query domain (spec/phases/phase-06.md, design addition 1):
// translation.forCampaign. Both actors may read it. Only the named campaign of the command's
// own open project is read; the reply holds no file path.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { openFor, requireCampaign } from './campaign-reads'
import { translationJobStates, translationRows } from '@/main/translation/rows'
import {
  translationForCampaignInput,
  type TranslationForCampaign,
} from '@/shared/schemas/queries/translation'

export function translationForCampaign(deps: Pick<CoreDeps, 'projects'>): QueryFn {
  return (raw): TranslationForCampaign => {
    const { input, project } = openFor(deps, translationForCampaignInput, raw)
    const campaign = requireCampaign(project.db, input.campaignId)
    return {
      primaryLanguage: campaign.primaryLanguage,
      rows: translationRows(project.db, campaign),
      jobs: translationJobStates(project.db, campaign.id),
    }
  }
}

export function translationQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'translation.forCampaign': translationForCampaign(deps) }
}

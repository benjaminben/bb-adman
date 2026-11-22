// The translation query domain (spec/phases/phase-06.md, design addition 1):
// translation.forCampaign. Both actors may read it. Only the named campaign of the command's
// own open project is read; the reply holds no file path.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { openFor, requireCampaign } from './campaign-reads'
import { translationJobStates, translationRows } from '@/main/translation/rows'
import { translationSources } from '@/main/translation/source-rows'
import {
  translationForCampaignInput,
  translationSourcesInput,
  type TranslationForCampaign,
  type TranslationSources,
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

// R3-3: the primary language's text layers and the out-of-date translations. Both actors may
// read it, as both may read those layers through variant.get.
export function translationSourcesQuery(deps: Pick<CoreDeps, 'projects'>): QueryFn {
  return (raw): TranslationSources => {
    const { input, project } = openFor(deps, translationSourcesInput, raw)
    return translationSources(project.db, requireCampaign(project.db, input.campaignId))
  }
}

export function translationQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'translation.forCampaign': translationForCampaign(deps) }
}

// R3-3: its own map, so the Phase 6 domain keeps its one query.
export function translationSourceQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'translation.sources': translationSourcesQuery(deps) }
}

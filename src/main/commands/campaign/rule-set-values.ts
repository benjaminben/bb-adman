// SPEC 6.1 "The other campaign.create inputs": the rule set a new campaign starts with.
import type { ProjectContext } from '@/main/commands/types'
import { readWireRow } from '@/main/db/rows'
import { wordsByLanguage } from '@/shared/brief/words'
import type { Brief } from '@/shared/schemas/brief'
import type { CampaignCreateInput, RuleSetValues } from '@/shared/schemas/commands/campaign'
import type { RuleSetRow } from '@/shared/schemas/rows/rule-set'
import { AppError } from '@/shared/schemas/result'

export function campaignNotFound(): AppError {
  return new AppError('NOT_FOUND', 'That campaign is not in this project.')
}

// Every required asset must be in the project. Slice C reads asset rows by ID only.
export function requireAssets(ctx: ProjectContext, assetIds: string[]): void {
  for (const id of assetIds) {
    if (!readWireRow(ctx.project.db, 'asset', { id })) {
      throw new AppError('NOT_FOUND', 'A file in the rule set is not in this project.')
    }
  }
}

// The four lists of another campaign of this project (SPEC 3.3 rule_set, FR-034).
export function ruleSetOf(ctx: ProjectContext, campaignId: string): RuleSetValues {
  const row = readWireRow(ctx.project.db, 'rule_set', { campaignId }) as RuleSetRow | null
  if (!readWireRow(ctx.project.db, 'campaign', { id: campaignId })) throw campaignNotFound()
  return {
    requiredAssetIds: row?.requiredAssetIds ?? [],
    palette: row?.palette ?? [],
    requiredWords: row?.requiredWords ?? {},
    prohibitedWords: row?.prohibitedWords ?? {},
  }
}

function briefWords(brief: Brief, primaryLanguage: string): RuleSetValues {
  const words = (list: Brief['requiredWords']) =>
    list === undefined ? {} : wordsByLanguage(list, primaryLanguage)
  return {
    requiredAssetIds: [],
    palette: [],
    requiredWords: words(brief.requiredWords),
    prohibitedWords: words(brief.prohibitedWords),
  }
}

// The given rule set, a copy of another campaign's, or the brief's word lists alone.
export function startingRuleSet(ctx: ProjectContext, input: CampaignCreateInput): RuleSetValues {
  if (input.ruleSet) {
    requireAssets(ctx, input.ruleSet.requiredAssetIds)
    return input.ruleSet
  }
  if (input.copyRuleSetFrom) return ruleSetOf(ctx, input.copyRuleSetFrom)
  return briefWords(input.brief, input.languages[0] ?? '')
}

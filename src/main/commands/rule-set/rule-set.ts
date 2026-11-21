// ruleSet.update and ruleSet.copyFrom (SPEC 4.2, 3.3 rule_set; FR-033, FR-034). Both are
// undoable on the campaign's list: the inverse is ruleSet.update with the lists as they were.
import type { ProjectContext } from '../types'
import { defineCommand } from '../types'
import { storedJson } from '../../db/rows'
import { requireAssets, ruleSetOf } from '../campaign/rule-set-values'
import type { RuleSetValues } from '../../../shared/schemas/commands/campaign'
import { ruleSetCopyFromInput, ruleSetUpdateInput } from '../../../shared/schemas/commands/rule-set'

const LISTS = ['requiredAssetIds', 'palette', 'requiredWords', 'prohibitedWords'] as const

const COLUMNS: Record<(typeof LISTS)[number], string> = {
  requiredAssetIds: 'required_asset_ids',
  palette: 'palette',
  requiredWords: 'required_words',
  prohibitedWords: 'prohibited_words',
}

// Writes the given lists over the campaign's rule set, making the row if a file lacks it.
function writeLists(ctx: ProjectContext, campaignId: string, lists: Partial<RuleSetValues>) {
  const given = LISTS.filter((l) => lists[l] !== undefined)
  if (given.length === 0) return
  const columns = given.map((l) => COLUMNS[l])
  const values = given.map((l) => storedJson('rule_set', l, lists[l]))
  const set = columns.map((c) => `"${c}" = excluded."${c}"`).join(', ')
  ctx.project.db
    .prepare(
      `INSERT INTO rule_set (campaign_id, ${columns.map((c) => `"${c}"`).join(', ')})
       VALUES (?, ${columns.map(() => '?').join(', ')})
       ON CONFLICT (campaign_id) DO UPDATE SET ${set}`,
    )
    .run(campaignId, ...values)
  ctx.changes.touch('rule_set', { campaignId })
}

function inverseOf(projectId: string, campaignId: string, before: Partial<RuleSetValues>) {
  return {
    scope: `campaign:${campaignId}`,
    call: { name: 'ruleSet.update', input: { projectId, campaignId, ...before } },
  }
}

function pick(values: RuleSetValues, lists: readonly (typeof LISTS)[number][]) {
  return Object.fromEntries(lists.map((l) => [l, values[l]])) as Partial<RuleSetValues>
}

export function ruleSetUpdate() {
  return defineCommand({
    name: 'ruleSet.update',
    input: ruleSetUpdateInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const current = ruleSetOf(ctx, input.campaignId)
      if (input.requiredAssetIds) requireAssets(ctx, input.requiredAssetIds)
      const given = LISTS.filter((l) => input[l] !== undefined)
      writeLists(ctx, input.campaignId, pick(input as RuleSetValues, given))
      return {
        data: { campaignId: input.campaignId },
        inverse: inverseOf(input.projectId, input.campaignId, pick(current, given)),
        log: { campaignId: input.campaignId },
      }
    },
  })
}

export function ruleSetCopyFrom() {
  return defineCommand({
    name: 'ruleSet.copyFrom',
    input: ruleSetCopyFromInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const current = ruleSetOf(ctx, input.campaignId)
      const source = ruleSetOf(ctx, input.sourceCampaignId)
      writeLists(ctx, input.campaignId, source)
      return {
        data: { campaignId: input.campaignId },
        inverse: inverseOf(input.projectId, input.campaignId, current),
        log: { campaignId: input.campaignId },
      }
    },
  })
}

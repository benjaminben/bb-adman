// campaign.create (SPEC 4.2 notes, 6.1; FR-023 to FR-026, FR-043, R-01). Not undoable
// [D-010]. Makes the campaign, its subjects as the map asks, its rule set and its master
// (master-rows.ts). The brief's layout and brand shape the rule set and the master
// (spec/brief-brand.md "campaign.create"); every refusal comes before the first write.
import type { CoreDeps } from '@/main/core-deps'
import { defineCommand, type ProjectContext } from '@/main/commands/types'
import * as schema from '@/main/db/schema'
import { readWireRow, storedJson } from '@/main/db/rows'
import { insertSubject } from '@/main/commands/subject/subject'
import { newCampaignId } from './ids'
import { startingRuleSet } from './rule-set-values'
import { checkBrandAssets } from './brand-assets'
import { insertMaster } from './master-rows'
import { isRightToLeft } from '@/shared/brief/languages'
import { brandRuleSet } from '@/shared/brief/brand-rule-set'
import { starterLayoutOf } from '@/shared/config/starter-layouts'
import { DEFAULT_STARTER_LAYOUT, type StarterLayout } from '@/shared/config/default-layout'
import { starterTemplate } from '@/shared/templates/starter'
import { SubjectId } from '@/shared/schemas/commands/subject'
import {
  campaignCreateInput,
  type CampaignCreateInput,
  type RuleSetValues,
} from '@/shared/schemas/commands/campaign'
import type { CampaignCreated } from '@/shared/schemas/commands/campaign-edit'
import { AppError } from '@/shared/schemas/result'

export function refuseRightToLeft(languages: string[]): void {
  if (languages.some(isRightToLeft)) {
    throw new AppError('RULE_VIOLATION', 'Right-to-left languages are not supported yet.')
  }
}

// SPEC 6.1 subjectMap: create: true makes the subject from the brief entry, create: false
// uses one the project holds. Returns the subject IDs in brief order, each once.
function mapSubjects(ctx: ProjectContext, input: CampaignCreateInput, now: string): string[] {
  const ids: string[] = []
  input.subjectMap.forEach((entry, i) => {
    const subject = input.brief.subjects[i]
    if (entry.create && subject) {
      if (!SubjectId.safeParse(entry.subjectId).success) {
        throw new AppError(
          'INVALID_INPUT',
          'A new subject ID may hold only A-Z, a-z, 0-9, - and _.',
        )
      }
      insertSubject(ctx, {
        id: entry.subjectId,
        name: subject.name,
        description: subject.description ?? '',
        createdAt: now,
      })
    } else if (!readWireRow(ctx.project.db, 'subject', { id: entry.subjectId })) {
      throw new AppError('NOT_FOUND', 'That subject is not in this project.')
    }
    if (!ids.includes(entry.subjectId)) ids.push(entry.subjectId)
  })
  return ids
}

function insertCampaign(ctx: ProjectContext, input: CampaignCreateInput, now: string): string {
  const { brief } = input
  const id = newCampaignId(ctx.project.db, brief.campaignName)
  ctx.project.orm
    .insert(schema.campaign)
    .values({
      id,
      name: brief.campaignName,
      region: brief.region,
      audience: brief.audience,
      message: brief.message,
      offer: brief.offer ?? null,
      callToAction: brief.callToAction ?? null,
      tone: brief.tone ?? null,
      primaryLanguage: input.languages[0] ?? '',
      languages: JSON.stringify(input.languages),
      sizes: JSON.stringify(input.sizes),
      templateId: input.templateId,
      brief: JSON.stringify(brief),
      createdBy: ctx.actor === 'agent' ? 'agent' : 'user',
      createdAt: now,
    })
    .run()
  ctx.changes.touch('campaign', { id })
  return id
}

function insertRuleSet(ctx: ProjectContext, campaignId: string, values: RuleSetValues): void {
  const json = (field: keyof RuleSetValues) => storedJson('rule_set', field, values[field]) ?? ''
  ctx.project.orm
    .insert(schema.ruleSet)
    .values({
      campaignId,
      requiredAssetIds: json('requiredAssetIds'),
      palette: json('palette'),
      requiredWords: json('requiredWords'),
      prohibitedWords: json('prohibitedWords'),
    })
    .run()
  ctx.changes.touch('rule_set', { campaignId })
}

// No layout in the brief: the default. An ID the build does not have is refused.
function layoutOf(id: string | undefined): StarterLayout {
  if (id === undefined) return DEFAULT_STARTER_LAYOUT
  const layout = starterLayoutOf(id)
  if (!layout) throw new AppError('NOT_FOUND', 'That layout is not in this build.')
  return layout
}

// The whole of campaign.create's work, also run by campaign.createFromBrief (Round 2 plan D6).
export function createCampaignRows(
  ctx: ProjectContext,
  input: CampaignCreateInput,
  now: string,
): CampaignCreated {
  if (input.templateId !== starterTemplate.id) {
    throw new AppError('NOT_FOUND', 'That template is not in this build.')
  }
  refuseRightToLeft(input.languages)
  const layout = layoutOf(input.brief.layout)
  checkBrandAssets(ctx.project.db, input.brand)
  const values = brandRuleSet(
    startingRuleSet(ctx, input),
    input.brief.brand?.colours,
    input.brand?.logoAssetId,
  )
  const subjectIds = mapSubjects(ctx, input, now)
  const campaignId = insertCampaign(ctx, input, now)
  for (const subjectId of subjectIds) {
    ctx.project.orm.insert(schema.campaignSubject).values({ campaignId, subjectId }).run()
    ctx.changes.touch('campaign_subject', { campaignId, subjectId })
  }
  insertRuleSet(ctx, campaignId, values)
  const master = insertMaster(ctx, { campaignId, subjectIds, input, values, layout }, now)
  return { campaignId, ...master }
}

export function campaignCreate(deps: Pick<CoreDeps, 'now'>) {
  return defineCommand({
    name: 'campaign.create',
    input: campaignCreateInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const data = createCampaignRows(ctx, input, deps.now().toISOString())
      return { data, log: { campaignId: data.campaignId, variantId: data.variantId } }
    },
  })
}

// campaign.create (SPEC 4.2 notes, 6.1; FR-023 to FR-026, FR-043, R-01). Not undoable
// [D-010]. Makes the campaign, its subjects as the map asks, its rule set, one direction
// "Direction 1" and one master variant at the first size in the primary language, with a
// background layer and one layer per filled slot.
import { ulid } from 'ulid'
import type { CoreDeps } from '@/main/core-deps'
import { defineCommand, type ProjectContext } from '@/main/commands/types'
import * as schema from '@/main/db/schema'
import { readWireRow, storedJson } from '@/main/db/rows'
import { insertSubject } from '@/main/commands/subject/subject'
import { newCampaignId, newVariantId } from './ids'
import { slotFills } from './fills'
import { insertLayerRow } from './layer-row'
import { startingRuleSet } from './rule-set-values'
import { isRightToLeft } from '@/shared/brief/languages'
import { buildMasterLayers } from '@/shared/templates/master-layers'
import { starterTemplate } from '@/shared/templates/starter'
import { SubjectId } from '@/shared/schemas/commands/subject'
import {
  campaignCreateInput,
  type CampaignCreateInput,
  type RuleSetValues,
} from '@/shared/schemas/commands/campaign'
import type { CampaignCreated } from '@/shared/schemas/commands/campaign-edit'
import { AppError } from '@/shared/schemas/result'

const DEFAULT_DURATION_MS = 6000

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

type Master = { campaignId: string; subjectIds: string[]; input: CampaignCreateInput }

function insertMaster(ctx: ProjectContext, m: Master, now: string, values: RuleSetValues) {
  const { orm, db } = ctx.project
  const size = m.input.sizes[0]
  if (!size) throw new Error('campaign.create needs a size')
  const directionId = ulid()
  const variantId = newVariantId(db)
  orm
    .insert(schema.direction)
    .values({
      id: directionId,
      campaignId: m.campaignId,
      name: 'Direction 1',
      masterVariantId: variantId,
      sort: 0,
    })
    .run()
  orm
    .insert(schema.variant)
    .values({
      id: variantId,
      directionId,
      title: m.subjectIds.join('+'),
      width: size.width,
      height: size.height,
      sizeLabel: size.label,
      language: m.input.languages[0] ?? '',
      format: 'image',
      durationMs: DEFAULT_DURATION_MS,
      createdBy: ctx.actor === 'agent' ? 'agent' : 'user',
      createdAt: now,
    })
    .run()
  ctx.changes.touch('direction', { id: directionId })
  ctx.changes.touch('variant', { id: variantId })
  for (const subjectId of m.subjectIds) {
    orm.insert(schema.variantSubject).values({ variantId, subjectId }).run()
    ctx.changes.touch('variant_subject', { variantId, subjectId })
  }
  const { brief, placeSubjectPhoto } = m.input
  const fills = slotFills(db, starterTemplate, brief, m.subjectIds, values, placeSubjectPhoto)
  for (const layer of buildMasterLayers(starterTemplate, size, fills)) {
    insertLayerRow(ctx, { ...layer, id: ulid(), variantId })
  }
  return { directionId, variantId }
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
  const values = startingRuleSet(ctx, input)
  const subjectIds = mapSubjects(ctx, input, now)
  const campaignId = insertCampaign(ctx, input, now)
  for (const subjectId of subjectIds) {
    ctx.project.orm.insert(schema.campaignSubject).values({ campaignId, subjectId }).run()
    ctx.changes.touch('campaign_subject', { campaignId, subjectId })
  }
  insertRuleSet(ctx, campaignId, values)
  const master = insertMaster(ctx, { campaignId, subjectIds, input }, now, values)
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

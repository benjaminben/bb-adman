// campaign.create's master rows (SPEC 6.1; spec/brief-brand.md "campaign.create", step 4): one
// direction "Direction 1" and one master variant at the first size in the primary language,
// with a background layer and one layer per filled slot. The layers are built from the
// chosen starter layout, then take the brand fonts and the brand colours. With adsPer
// 'subject' and two or more subjects, one such direction per subject ("One direction per
// subject").
import { ulid } from 'ulid'
import type { ProjectContext } from '@/main/commands/types'
import * as schema from '@/main/db/schema'
import { readWireRow } from '@/main/db/rows'
import { newVariantId } from './ids'
import { slotFills } from './fills'
import { insertLayerRow } from './layer-row'
import { buildMasterLayers } from '@/shared/templates/master-layers'
import { withBrandFonts } from '@/shared/templates/brand-fonts'
import { withBrandColours } from '@/shared/templates/brand-colours'
import { starterTemplate } from '@/shared/templates/starter'
import type { StarterLayout } from '@/shared/config/default-layout'
import type {
  CampaignCreateInput,
  CampaignSize,
  RuleSetValues,
} from '@/shared/schemas/commands/campaign'

const DEFAULT_DURATION_MS = 6000
const MAX_DIRECTION_NAME = 100

// One direction to make: its name, its place and the subjects its master shows.
export type DirectionPlan = { name: string; sort: number; subjectIds: string[] }

export type Master = DirectionPlan & {
  campaignId: string
  input: CampaignCreateInput
  values: RuleSetValues
  layout: StarterLayout
}

// The subject's stored name, trimmed and cut to 100 characters; "Direction {n}" when empty.
function directionName(ctx: ProjectContext, subjectId: string, sort: number): string {
  const stored = readWireRow(ctx.project.db, 'subject', { id: subjectId })?.name
  const name = (typeof stored === 'string' ? stored : '').trim().slice(0, MAX_DIRECTION_NAME)
  return name === '' ? `Direction ${sort + 1}` : name
}

// One direction for all subjects, or one per subject in subject order (adsPer 'subject').
export function directionPlans(
  ctx: ProjectContext,
  input: CampaignCreateInput,
  subjectIds: string[],
): DirectionPlan[] {
  if (input.brief.adsPer !== 'subject' || subjectIds.length < 2) {
    return [{ name: 'Direction 1', sort: 0, subjectIds }]
  }
  return subjectIds.map((subjectId, sort) => ({
    name: directionName(ctx, subjectId, sort),
    sort,
    subjectIds: [subjectId],
  }))
}

function insertLayers(ctx: ProjectContext, m: Master, size: CampaignSize, variantId: string) {
  const { brief, placeSubjectPhoto, brand } = m.input
  const { db } = ctx.project
  const fills = slotFills(db, starterTemplate, brief, m.subjectIds, m.values, placeSubjectPhoto)
  const built = buildMasterLayers(starterTemplate, size, fills, m.layout)
  const fonts = { heading: brand?.headingFontAssetId, body: brand?.bodyFontAssetId }
  const layers = withBrandColours(withBrandFonts(built, fonts), brief.brand?.colours ?? [])
  for (const layer of layers) {
    insertLayerRow(ctx, { ...layer, id: ulid(), variantId })
  }
}

export function insertMaster(ctx: ProjectContext, m: Master, now: string) {
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
      name: m.name,
      masterVariantId: variantId,
      sort: m.sort,
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
  insertLayers(ctx, m, size, variantId)
  return { directionId, variantId }
}

// campaign.create's master rows (SPEC 6.1; spec/brief-brand.md "campaign.create", step 4): one
// direction "Direction 1" and one master variant at the first size in the primary language,
// with a background layer and one layer per filled slot. The layers are built from the
// chosen starter layout, then take the brand fonts and the brand colours.
import { ulid } from 'ulid'
import type { ProjectContext } from '@/main/commands/types'
import * as schema from '@/main/db/schema'
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

export type Master = {
  campaignId: string
  subjectIds: string[]
  input: CampaignCreateInput
  values: RuleSetValues
  layout: StarterLayout
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
  insertLayers(ctx, m, size, variantId)
  return { directionId, variantId }
}
